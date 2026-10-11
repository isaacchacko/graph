"use client";

import type { GraphRenderer, InteractionMode, PartialOptions, Point, Selection } from "@graph/renderer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DRAWER_WIDTH_PX, GraphDrawer, type ExportKind } from "./GraphDrawer";
import { GraphCanvas } from "./GraphCanvas";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appendLine, deleteLink, deleteNode, replaceNameSpans, setLinkWeight } from "@/lib/edit";
import { fruitName } from "@/lib/fruits";
import { SESSION_PREFIX, useHistory } from "@/lib/history";
import { arrowLinks, formatName, parseGraph, type ParseResult, type Span } from "@/lib/parse";
import { useMediaQuery } from "@/lib/platform";
import { decodeState, decorate, encodeState, matchesQuery, withDefaults, type AppState } from "@/lib/state";
import { TEMPLATES, type Template } from "@/lib/templates";
import { themeById, type AppTheme } from "@/lib/themes";

const STORAGE_KEY = "graph:v1";
const LINE_HEIGHT_PX = 20;

/** What is being typed into on the canvas: a node's name or a link's weight. */
type Editing =
  | {
      kind: "node";
      /** The node's name in the source right now. */
      id: string;
      original: string;
      text: string;
      /** The source when renaming began; every keystroke rewrites `spans` in it afresh. */
      base: string;
      spans: Span[];
      session: string;
      /** The renderer node being renamed, or null while it is merged into a same-named node. */
      renderId: string | null;
      lastPosition: Point | null;
      changed: boolean;
    }
  | { kind: "link"; source: string; target: string; text: string };

let sessions = 0;

export function GraphStudio() {
  const history = useHistory<AppState>(() => withDefaults({ source: TEMPLATES[0].source() }));
  const state = history.value;
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [mode, setMode] = useState<InteractionMode>("edit");
  const wide = useMediaQuery("(min-width: 768px)");
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null);
  const [spawnPoints, setSpawnPoints] = useState<Record<string, Point>>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  /** Set when a canvas press only served to finish an edit, so it must not also act. */
  const swallowClick = useRef(false);
  const overlay = useRef<HTMLElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});

  const setEditing = useCallback((next: Editing | null) => {
    editingRef.current = next;
    setEditingState(next);
  }, []);

  const { reset: resetHistory } = history;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = window.location.hash.slice(1);
      let initial = hash ? await decodeState(hash) : null;
      if (hash) window.history.replaceState(null, "", window.location.pathname);
      if (!initial) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) initial = withDefaults(JSON.parse(saved));
        } catch {
          // Corrupt or unavailable storage: start fresh.
        }
      }
      if (cancelled) return;
      if (initial) resetHistory(initial);
      if (window.innerWidth < 768) setDrawerOpen(false);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [resetHistory]);

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
    const decorated = decorate(parsed.data, state.groups, state.settings, {
      categories: theme.palette,
      low: theme.graph.node,
      high: theme.graph.accent,
    });
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
  }, [parsed, state.groups, state.settings, theme, spawnPoints, editing]);

  // A selection can outlive its target (undo, edits in the source): ignore it then.
  const liveSelection = useMemo<Selection>(() => {
    if (selection?.kind === "node") return parsed.data.nodes.some((n) => n.id === selection.id) ? selection : null;
    if (selection?.kind === "link") return parsed.data.links.some((l) => l.source === selection.source && l.target === selection.target) ? selection : null;
    if (selection?.kind === "nodes") {
      const ids = selection.ids.filter((id) => parsed.data.nodes.some((n) => n.id === id));
      return ids.length ? { kind: "nodes", ids } : null;
    }
    return null;
  }, [selection, parsed]);

  const highlights = useMemo(() => highlightRanges(state.source, parsed, liveSelection), [state.source, parsed, liveSelection]);

  const options = useMemo<PartialOptions>(() => {
    const { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows } = state.settings;
    return { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows, mode, theme: theme.graph };
  }, [state.settings, theme, mode]);

  const highlighted = useMemo(
    () => (search.trim() ? data.nodes.filter((n) => matchesQuery(n.label ?? n.id, search)).map((n) => n.id) : null),
    [data, search],
  );

  const { set: record } = history;
  const update = useCallback((patch: Partial<AppState>, merge?: string) => record((s) => ({ ...s, ...patch }), merge), [record]);
  const editSource = useCallback((edit: (source: string) => string) => record((s) => ({ ...s, source: edit(s.source) })), [record]);

  // ── Renaming and weighing ───────────────────────────────────────────

  /** Renames the node being edited to `text`, live, by rewriting its spans in the pre-edit source. */
  const renameTo = (ed: Extract<Editing, { kind: "node" }>, text: string): Editing => {
    const target = text.trim() || ed.original;
    if (target === ed.id) return { ...ed, text };
    const collides = parsed.data.nodes.some((n) => n.id === target && n.id !== ed.id);
    const position = (ed.renderId && renderer?.getNodePosition(ed.renderId)) || ed.lastPosition;
    if (!collides && ed.renderId) renderer?.renameNode(ed.renderId, target);
    if (position) setSpawnPoints((points) => ({ ...points, [target]: position }));
    record((s) => ({ ...s, source: replaceNameSpans(ed.base, ed.spans, target) }), ed.session);
    setSelection({ kind: "node", id: target });
    return { ...ed, id: target, text, renderId: collides ? null : target, lastPosition: position, changed: true };
  };

  const startEdit = (sel: Exclude<Selection, null | { kind: "nodes" }>, text: string | null) => {
    if (sel.kind === "link") {
      const label = parsed.data.links.find((l) => l.source === sel.source && l.target === sel.target)?.label ?? "";
      setEditing({ kind: "link", source: sel.source, target: sel.target, text: text ?? label });
      return;
    }
    const ed: Editing = {
      kind: "node",
      id: sel.id,
      original: sel.id,
      text: sel.id,
      base: state.source,
      spans: parsed.names.get(sel.id) ?? [],
      session: `${SESSION_PREFIX}rename-${++sessions}`,
      renderId: sel.id,
      lastPosition: null,
      changed: false,
    };
    setEditing(text === null ? ed : renameTo(ed, text));
  };

  const commitEdit = () => {
    const ed = editingRef.current;
    if (!ed) return;
    setEditing(null);
    if (ed.kind === "link") {
      editSource((src) => setLinkWeight(src, parseGraph(src), ed.source, ed.target, ed.text.trim()));
      return;
    }
    // An emptied name falls back to the next free fruit.
    if (!ed.text.trim()) renameTo(ed, fruitName(parsed.data.nodes.map((n) => n.id).filter((id) => id !== ed.id)));
  };

  const cancelEdit = () => {
    const ed = editingRef.current;
    setEditing(null);
    if (ed?.kind !== "node" || !ed.changed) return;
    history.discard();
    if (ed.renderId && ed.renderId !== ed.original) renderer?.renameNode(ed.renderId, ed.original);
    setSelection({ kind: "node", id: ed.original });
  };

  // ── Creating and deleting ───────────────────────────────────────────

  const createNodeAt = (world: Point) => {
    const name = fruitName(parsed.data.nodes.map((n) => n.id));
    setSpawnPoints((points) => ({ ...points, [name]: world }));
    record((s) => ({
      ...s,
      source: appendLine(s.source, formatName(name)),
      settings: s.settings.showOrphans ? s.settings : { ...s.settings, showOrphans: true },
    }));
    setSelection({ kind: "node", id: name });
  };

  const remove = (target: NonNullable<Selection>) => {
    if (target.kind === "node") editSource((src) => deleteNode(src, parseGraph(src), target.id));
    else if (target.kind === "nodes") editSource((src) => target.ids.reduce((acc, id) => deleteNode(acc, parseGraph(acc), id), src));
    else editSource((src) => deleteLink(src, parseGraph(src), target.source, target.target));
    setSelection(null);
  };

  // ── Overlay: the input being typed into, or a hint beside the selection ──

  const anchor = editing
    ? editing.kind === "node"
      ? ({ kind: "node", id: editing.id } as const)
      : ({ kind: "link", source: editing.source, target: editing.target } as const)
    : mode === "edit" && liveSelection?.kind !== "nodes"
      ? liveSelection
      : null;
  const anchorKey = anchor ? (anchor.kind === "node" ? `n:${anchor.id}` : `l:${anchor.source}\u0000${anchor.target}`) : null;

  useEffect(() => {
    if (!renderer || !anchor) return;
    let raf = 0;
    const follow = () => {
      const el = overlay.current;
      if (el && anchor) {
        if (anchor.kind === "node") {
          const box = renderer.getNodeScreenBox(anchor.id);
          if (box) el.style.transform = `translate(${box.x}px, ${box.y + box.r + 4}px) translateX(-50%)`;
        } else {
          const mid = renderer.getLinkScreenMidpoint(anchor.source, anchor.target);
          if (mid) el.style.transform = `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%)`;
        }
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
    // anchorKey identifies the anchor; the object itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, anchorKey, editing !== null]);

  // Bring the first highlighted mention into view when the selection changes.
  const firstHighlight = highlights[0]?.[0];
  const selectionKey = liveSelection ? JSON.stringify(liveSelection) : null;
  useEffect(() => {
    const el = textarea.current;
    if (!el || firstHighlight === undefined || !selectionKey) return;
    const line = el.value.slice(0, firstHighlight).split("\n").length - 1;
    el.scrollTop = Math.max(0, line * LINE_HEIGHT_PX - el.clientHeight / 3);
    // Only when a different thing gets selected, not on every edit of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

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

  const applyTemplate = (template: Template) => record((s) => ({ ...s, source: template.source() }));

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
    renderer.setInsets({ left: drawerOpen && wide ? DRAWER_WIDTH_PX : 0 });
  }, [renderer, drawerOpen, wide]);

  // Theme the whole document, so menus and tooltips portalled outside this tree match too.
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVars(theme);
    root.classList.toggle("dark", !theme.light);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [theme]);

  // ── Keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Plain inputs keep their own undo; the source text and the canvas share the graph's.
      if (mod && (key === "z" || key === "y") && target.tagName !== "INPUT") {
        e.preventDefault();
        if (key === "y" || e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (target.closest("input, textarea, select, [role=combobox]") || mod || e.altKey) return;

      if (e.key === "Escape") {
        if (liveSelection) setSelection(null);
        else setDrawerOpen((v) => !v);
        e.preventDefault();
        return;
      }

      // A box selection only supports bulk delete; other keys fall through to the shortcuts.
      if (mode === "edit" && liveSelection?.kind === "nodes" && (e.key === "Backspace" || e.key === "Delete")) {
        remove(liveSelection);
        e.preventDefault();
        return;
      }

      // With one thing selected in edit mode, typing edits it.
      if (mode === "edit" && liveSelection && liveSelection.kind !== "nodes") {
        if (e.key === "Backspace" || e.key === "Delete") remove(liveSelection);
        else if (e.key === "Enter" || e.key === "F2") startEdit(liveSelection, null);
        else if (e.key.length === 1) startEdit(liveSelection, e.key);
        else return;
        e.preventDefault();
        return;
      }

      if (key === "s") setMode("select");
      else if (key === "e") setMode("edit");
      else if (key === "f") zoom("fit");
      else if (key === "=" || key === "+") zoom("in");
      else if (key === "-") zoom("out");
      else return;
      e.preventDefault();
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const editingText = editing?.text ?? "";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed inset-0 overflow-hidden text-foreground" style={{ background: theme.graph.background ?? undefined }}>
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
              selection={liveSelection}
              onReady={setRenderer}
              onConnect={({ source, target }) => {
                editSource((src) => appendLine(src, `${formatName(source)} -> ${formatName(target)}`));
                setSelection({ kind: "link", source, target });
              }}
              onBackgroundClick={({ world }) => {
                if (swallowClick.current) return;
                if (mode === "edit") createNodeAt(world);
                else setSelection(null);
              }}
              onLinkClick={({ source, target }) => !swallowClick.current && setSelection({ kind: "link", source, target })}
              onNodeClick={({ id }) => !swallowClick.current && setSelection({ kind: "node", id })}
              onBoxSelect={({ ids }) => setSelection(ids.length ? { kind: "nodes", ids } : null)}
              onNodeContextMenu={({ id, event }) => {
                if (mode !== "edit") return;
                event.preventDefault();
                // Right-clicking any node of a box selection deletes the whole box.
                remove(liveSelection?.kind === "nodes" && liveSelection.ids.includes(id) ? liveSelection : { kind: "node", id });
              }}
              onLinkContextMenu={({ source, target, event }) => {
                if (mode !== "edit") return;
                event.preventDefault();
                remove({ kind: "link", source, target });
              }}
            />
          )}
        </div>

        {loaded && data.nodes.length === 0 && !editing && (
          <div
            style={{ paddingLeft: drawerOpen && wide ? DRAWER_WIDTH_PX : 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            <span>{mode === "edit" ? "Click anywhere to add a node." : "Switch to edit mode (E) to add nodes."}</span>
          </div>
        )}

        {editing ? (
          <Input
            key={anchorKey}
            ref={(el) => {
              overlay.current = el;
            }}
            autoFocus
            value={editing.text}
            placeholder={editing.kind === "node" ? "fruit name" : "weight"}
            onChange={(e) => {
              const ed = editingRef.current;
              if (!ed) return;
              setEditing(ed.kind === "node" ? renameTo(ed, e.target.value) : { ...ed, text: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              else if (e.key === "Escape") cancelEdit();
            }}
            onBlur={commitEdit}
            style={{ width: Math.max(96, (editingText || "fruit name").length * 8 + 28) }}
            className="absolute top-0 left-0 z-30 h-7 border-primary bg-background px-2 text-center text-xs shadow-lg"
          />
        ) : (
          anchor && (
            <div
              key={anchorKey}
              ref={(el) => {
                overlay.current = el;
              }}
              className={`pointer-events-none absolute top-0 left-0 z-30 border bg-background/90 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground ${
                anchor.kind === "node" ? "mt-5" : "mt-6"
              }`}
            >
              {anchor.kind === "node" ? "type to rename · ⌫ delete" : "type a weight · ⌫ delete"}
            </div>
          )
        )}

        <GraphDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          mode={mode}
          onMode={setMode}
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          state={state}
          update={update}
          onTemplate={applyTemplate}
          theme={theme}
          errors={parsed.errors}
          highlights={highlights}
          search={search}
          onSearch={setSearch}
          textareaRef={textarea}
          onAnimate={() => renderer?.replay(Math.min(8000, 1500 + data.nodes.length * 40))}
          onZoom={zoom}
          onExport={exportAs}
          onShare={share}
        />

        {liveSelection?.kind === "nodes" && (
          <div
            style={{ paddingLeft: drawerOpen && wide ? DRAWER_WIDTH_PX : 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center transition-[padding] duration-300"
          >
            <span className="border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-lg backdrop-blur-xl">
              {liveSelection.ids.length} node{liveSelection.ids.length === 1 ? "" : "s"} selected · ⌫ or right-click to delete · Esc to clear
            </span>
          </div>
        )}

        <Toaster theme={theme.light ? "light" : "dark"} position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}

/** Character ranges in the source to mark for the current selection. */
function highlightRanges(source: string, parsed: ParseResult, selection: Selection): [number, number][] {
  if (!selection) return [];
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const toRange = (s: Span): [number, number] => [lineStarts[s.line] + s.start, lineStarts[s.line] + s.end];

  if (selection.kind === "node") return (parsed.names.get(selection.id) ?? []).map(toRange);
  if (selection.kind === "nodes") return selection.ids.flatMap((id) => (parsed.names.get(id) ?? []).map(toRange));
  // Every arrow that makes this link.
  return parsed.statements.flatMap((st) =>
    st.arrows
      .filter((arrow, k) =>
        st.groups[k].some((a) =>
          st.groups[k + 1].some((b) => arrowLinks(arrow, a.name, b.name).some(([s, t]) => s === selection.source && t === selection.target)),
        ),
      )
      .map(toRange),
  );
}

/** Points shadcn's tokens at the active theme's canvas background and accent. */
function themeVars(theme: AppTheme): Record<string, string> {
  const { background, accent } = theme.graph;
  return {
    ...(background ? { "--background": background } : {}),
    "--primary": accent,
    "--primary-foreground": readableOn(accent),
    "--ring": accent,
  };
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
