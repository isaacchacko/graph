"use client";

import type { GraphRenderer, PartialOptions, Point } from "@graph/renderer";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { DRAWER_WIDTH_PX, GraphDrawer, type ExportKind } from "./GraphDrawer";
import { GraphCanvas } from "./GraphCanvas";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { appendLine, renameNode, setLinkWeight, uniqueName } from "@/lib/edit";
import { formatName, parseGraph } from "@/lib/parse";
import { decodeState, decorate, encodeState, matchesQuery, withDefaults, type AppState } from "@/lib/state";
import { TEMPLATES } from "@/lib/templates";
import { themeById, type AppTheme } from "@/lib/themes";

const STORAGE_KEY = "graph:v1";
const LINE_HEIGHT_PX = 20;

/** What is being typed into on the canvas: a node's name or a link's weight. */
type Editing =
  | { kind: "node"; id: string; text: string; undo: string | null }
  | { kind: "link"; source: string; target: string; text: string };

export function GraphStudio() {
  const [state, setState] = useState<AppState>(() => withDefaults({ source: TEMPLATES[0].source() }));
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null);
  const [spawnPoints, setSpawnPoints] = useState<Record<string, Point>>({});
  const [editing, setEditingState] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  /** Set when a canvas press only served to finish an edit, so it must not also act. */
  const swallowClick = useRef(false);
  const overlay = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const setEditing = useCallback((next: Editing | null) => {
    editingRef.current = next;
    setEditingState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = window.location.hash.slice(1);
      let initial = hash ? await decodeState(hash) : null;
      if (hash) history.replaceState(null, "", window.location.pathname);
      if (!initial) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) initial = withDefaults(JSON.parse(saved));
        } catch {
          // Corrupt or unavailable storage: start fresh.
        }
      }
      if (cancelled) return;
      if (initial) setState(initial);
      if (window.innerWidth < 768) setDrawerOpen(false);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full or blocked; the share link still works.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [state, loaded]);

  const theme = themeById(state.themeId);
  const parsed = useMemo(() => parseGraph(state.source), [state.source]);
  const data = useMemo(() => {
    const decorated = decorate(parsed.data, state.groups, state.settings.showOrphans);
    // Whatever is being typed into is drawn by the input on top, not the canvas.
    const nodes = decorated.nodes.map((n) => ({
      ...n,
      ...spawnPoints[n.id],
      ...(editing?.kind === "node" && editing.id === n.id ? { label: "" } : {}),
    }));
    const links = decorated.links.map((l) =>
      editing?.kind === "link" && editing.source === l.source && editing.target === l.target ? { ...l, label: undefined } : l,
    );
    return { nodes, links };
  }, [parsed, state.groups, state.settings.showOrphans, spawnPoints, editing]);

  const options = useMemo<PartialOptions>(() => {
    const { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows } = state.settings;
    return { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows, theme: theme.graph };
  }, [state.settings, theme]);

  const highlighted = useMemo(
    () => (search.trim() ? data.nodes.filter((n) => matchesQuery(n.label ?? n.id, search)).map((n) => n.id) : null),
    [data, search],
  );

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const editSource = useCallback((edit: (source: string) => string) => setState((s) => ({ ...s, source: edit(s.source) })), []);

  // ── Canvas editing ──────────────────────────────────────────────────

  const commitEdit = useCallback(() => {
    const current = editingRef.current;
    if (!current) return;
    setEditing(null);
    const text = current.text.trim();
    if (current.kind === "link") {
      editSource((src) => setLinkWeight(src, parseGraph(src), current.source, current.target, text));
      return;
    }
    if (!text || text === current.id) return;
    renderer?.renameNode(current.id, text);
    setSpawnPoints((points) => {
      const { [current.id]: at, ...rest } = points;
      return at ? { ...rest, [text]: at } : rest;
    });
    editSource((src) => renameNode(src, parseGraph(src), current.id, text));
  }, [editSource, renderer, setEditing]);

  const cancelEdit = useCallback(() => {
    const current = editingRef.current;
    setEditing(null);
    // Escaping a node you just made un-makes it.
    if (current?.kind === "node" && current.undo !== null) update({ source: current.undo });
  }, [setEditing, update]);

  const createNodeAt = (world: Point) => {
    const name = uniqueName(parsed.data.nodes.map((n) => n.id));
    setSpawnPoints((points) => ({ ...points, [name]: world }));
    if (!state.settings.showOrphans) update({ settings: { ...state.settings, showOrphans: true } });
    editSource((src) => appendLine(src, formatName(name)));
    setEditing({ kind: "node", id: name, text: "", undo: state.source });
  };

  const editKey = editing ? (editing.kind === "node" ? `n:${editing.id}` : `l:${editing.source}\u0000${editing.target}`) : null;

  // Keep the input pinned to the moving node or link midpoint.
  useEffect(() => {
    if (!renderer || !editKey) return;
    let raf = 0;
    const follow = () => {
      const current = editingRef.current;
      const el = overlay.current;
      if (current && el) {
        if (current.kind === "node") {
          const box = renderer.getNodeScreenBox(current.id);
          if (box) el.style.transform = `translate(${box.x}px, ${box.y + box.r + 4}px) translateX(-50%)`;
        } else {
          const mid = renderer.getLinkScreenMidpoint(current.source, current.target);
          if (mid) el.style.transform = `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%)`;
        }
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [renderer, editKey]);

  const revealInSource = useCallback((id: string) => {
    const el = textarea.current;
    if (!el) return;
    const lines = el.value.split("\n");
    const needles = [formatName(id), id];
    const index = lines.findIndex((l) => !l.trim().startsWith("#") && needles.some((n) => l.includes(n)));
    if (index < 0) return;
    const start = lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
    el.focus({ preventScroll: true });
    el.setSelectionRange(start, start + lines[index].length);
    el.scrollTop = Math.max(0, index * LINE_HEIGHT_PX - el.clientHeight / 3);
  }, []);

  // ── Drawer actions ──────────────────────────────────────────────────

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${await encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const exportAs = async (kind: ExportKind) => {
    if (!renderer) return;
    if (kind === "svg") {
      download(new Blob([renderer.toSVG()], { type: "image/svg+xml" }), "graph.svg");
      return;
    }
    const blob = await renderer.toPNG({ transparent: kind === "png-transparent" });
    if (kind !== "copy") {
      download(blob, "graph.png");
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied");
    } catch {
      toast.error("Your browser blocked copying images");
    }
  };

  const zoom = useCallback(
    (action: "in" | "out" | "fit" | "shake") => {
      if (action === "in") renderer?.zoomBy(1.4);
      else if (action === "out") renderer?.zoomBy(1 / 1.4);
      else if (action === "fit") renderer?.zoomToFit();
      else renderer?.reheat();
    },
    [renderer],
  );

  useEffect(() => {
    if (!renderer) return;
    const inset = () => renderer.setInsets({ left: drawerOpen && window.innerWidth >= 768 ? DRAWER_WIDTH_PX : 0 });
    inset();
    window.addEventListener("resize", inset);
    return () => window.removeEventListener("resize", inset);
  }, [renderer, drawerOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [role=combobox]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f") zoom("fit");
      else if (e.key === "e") setDrawerOpen((v) => !v);
      else if (e.key === "=" || e.key === "+") zoom("in");
      else if (e.key === "-") zoom("out");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <div className={`fixed inset-0 overflow-hidden text-foreground ${theme.light ? "" : "dark"}`} style={themeVars(theme)}>
      <div
        className="absolute inset-0"
        onPointerDownCapture={() => {
          swallowClick.current = editingRef.current !== null;
          commitEdit();
        }}
      >
        {loaded && (
          <GraphCanvas
            className="absolute inset-0"
            data={data}
            options={options}
            highlighted={highlighted}
            onReady={setRenderer}
            onConnect={({ source, target }) => editSource((src) => appendLine(src, `${formatName(source)} -> ${formatName(target)}`))}
            onBackgroundClick={({ world }) => !swallowClick.current && createNodeAt(world)}
            onLinkClick={({ source, target }) => {
              if (swallowClick.current) return;
              const label = data.links.find((l) => l.source === source && l.target === target)?.label ?? "";
              setEditing({ kind: "link", source, target, text: label });
            }}
            onNodeClick={({ id }) => !swallowClick.current && drawerOpen && revealInSource(id)}
          />
        )}
      </div>

      {loaded && data.nodes.length === 0 && !editing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Click anywhere to add a node.
        </div>
      )}

      {editing && (
        <Input
          key={editKey}
          ref={overlay}
          autoFocus
          value={editing.text}
          placeholder={editing.kind === "node" ? editing.id : "weight"}
          onChange={(e) => setEditing({ ...editing, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            else if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          style={{ width: Math.max(96, (editing.text || (editing.kind === "node" ? editing.id : "weight")).length * 8 + 28) }}
          className="absolute top-0 left-0 z-30 h-7 border-primary bg-background px-2 text-center text-xs shadow-lg"
        />
      )}

      <GraphDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        state={state}
        update={update}
        theme={theme}
        errors={parsed.errors}
        stats={{ nodes: data.nodes.length, links: data.links.length }}
        search={search}
        onSearch={setSearch}
        textareaRef={textarea}
        onAnimate={() => renderer?.replay(Math.min(8000, 1500 + data.nodes.length * 40))}
        onZoom={zoom}
        onExport={exportAs}
        onShare={share}
      />

      <Toaster theme={theme.light ? "light" : "dark"} position="bottom-right" />
    </div>
  );
}

/** Points shadcn's tokens at the active graph theme. */
function themeVars(theme: AppTheme): CSSProperties {
  const { background, accent } = theme.graph;
  return {
    background: background ?? undefined,
    "--background": background ?? undefined,
    "--primary": accent,
    "--primary-foreground": readableOn(accent),
    "--ring": accent,
  } as CSSProperties;
}

/** Black or white, whichever reads better on `hex`. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#111111" : "#ffffff";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
