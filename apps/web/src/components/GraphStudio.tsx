"use client";

import type { GraphRenderer, PartialOptions, Point } from "@graph/renderer";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Panel } from "./controls";
import { EditorPanel } from "./EditorPanel";
import { GraphCanvas } from "./GraphCanvas";
import { SettingsPanel } from "./SettingsPanel";
import { formatName, parseGraph } from "@/lib/parse";
import { decodeState, decorate, encodeState, matchesQuery, withDefaults, type AppState } from "@/lib/state";
import { TEMPLATES } from "@/lib/templates";
import { themeById, type AppTheme } from "@/lib/themes";

const STORAGE_KEY = "graph:v1";
const LINE_HEIGHT_PX = 20;
const EDITOR_WIDTH_PX = 380;
const SETTINGS_WIDTH_PX = 280;

export function GraphStudio() {
  const [state, setState] = useState<AppState>(() => withDefaults({ source: TEMPLATES[0].source() }));
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null);
  const [draft, setDraft] = useState<{ screen: Point; world: Point } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [spawnPoints, setSpawnPoints] = useState<Record<string, Point>>({});
  const textarea = useRef<HTMLTextAreaElement>(null);

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
      if (window.innerWidth < 768) setEditorOpen(false);
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const theme = themeById(state.themeId);
  const parsed = useMemo(() => parseGraph(state.source), [state.source]);
  const data = useMemo(() => {
    const decorated = decorate(parsed.data, state.groups, state.settings.showOrphans);
    const nodes = decorated.nodes.map((n) => {
      const at = spawnPoints[n.id];
      return at ? { ...n, ...at } : n;
    });
    return { nodes, links: decorated.links };
  }, [parsed, state.groups, state.settings.showOrphans, spawnPoints]);

  const options = useMemo<PartialOptions>(() => {
    const { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows } = state.settings;
    return { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows, theme: theme.graph };
  }, [state.settings, theme]);

  const highlighted = useMemo(
    () => (search.trim() ? data.nodes.filter((n) => matchesQuery(n.label ?? n.id, search)).map((n) => n.id) : null),
    [data, search],
  );

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);

  const appendLine = useCallback((line: string) => {
    setState((s) => ({ ...s, source: s.source.trimEnd() ? `${s.source.trimEnd()}\n${line}\n` : `${line}\n` }));
  }, []);

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

  const addDraftNode = (name: string) => {
    const trimmed = name.trim();
    if (draft && trimmed && !parsed.data.nodes.some((n) => n.id === trimmed)) {
      setSpawnPoints((points) => ({ ...points, [trimmed]: draft.world }));
      appendLine(formatName(trimmed));
    }
    setDraft(null);
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${await encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Share link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const exportAs = async (kind: "png" | "png-transparent" | "svg" | "copy") => {
    setExportOpen(false);
    if (!renderer) return;
    if (kind === "svg") {
      download(new Blob([renderer.toSVG()], { type: "image/svg+xml" }), "graph.svg");
      return;
    }
    const blob = await renderer.toPNG({ transparent: kind === "png-transparent" });
    if (kind === "copy") {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setToast("Image copied");
      } catch {
        setToast("Your browser blocked clipboard images");
      }
      return;
    }
    download(blob, "graph.png");
  };

  useEffect(() => {
    if (!renderer) return;
    const frame = () => {
      const wide = window.innerWidth >= 768;
      renderer.setInsets({
        top: 60,
        left: wide && editorOpen ? EDITOR_WIDTH_PX + 16 : 0,
        right: wide && settingsOpen ? SETTINGS_WIDTH_PX + 16 : 0,
      });
    };
    frame();
    window.addEventListener("resize", frame);
    return () => window.removeEventListener("resize", frame);
  }, [renderer, editorOpen, settingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f") renderer?.zoomToFit();
      else if (e.key === "e") setEditorOpen((v) => !v);
      else if (e.key === ",") setSettingsOpen((v) => !v);
      else if (e.key === "=" || e.key === "+") renderer?.zoomBy(1.4);
      else if (e.key === "-") renderer?.zoomBy(1 / 1.4);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renderer]);

  return (
    <div className="fixed inset-0 overflow-hidden" style={chromeVars(theme)}>
      {loaded && (
        <GraphCanvas
          className="absolute inset-0"
          data={data}
          options={options}
          highlighted={highlighted}
          onReady={setRenderer}
          onConnect={({ source, target }) => appendLine(`${formatName(source)} -> ${formatName(target)}`)}
          onBackgroundDoubleClick={({ world }) => renderer && setDraft({ world, screen: renderer.worldToScreen(world) })}
          onBackgroundClick={() => setExportOpen(false)}
          onNodeClick={({ id }) => editorOpen && revealInSource(id)}
        />
      )}

      {loaded && data.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Double-click anywhere to add a node — or type in the editor.
        </div>
      )}

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Panel className="flex items-center gap-0.5 p-1">
          <span className="flex items-center gap-1.5 px-2 text-[13px] font-semibold tracking-tight">
            <Logo /> graph
          </span>
          <Divider />
          <Button onClick={() => setEditorOpen((v) => !v)} title="Toggle editor (E)">
            {editorOpen ? "Hide source" : "Edit source"}
          </Button>
          <Button onClick={share} title="Copy a link that opens this exact graph">
            Share
          </Button>
          <div className="relative">
            <Button onClick={() => setExportOpen((v) => !v)}>Export ▾</Button>
            {exportOpen && (
              <Panel className="absolute top-full left-0 mt-2 flex w-44 flex-col p-1">
                <MenuItem onClick={() => exportAs("png")}>PNG</MenuItem>
                <MenuItem onClick={() => exportAs("png-transparent")}>PNG, transparent</MenuItem>
                <MenuItem onClick={() => exportAs("svg")}>SVG</MenuItem>
                <MenuItem onClick={() => exportAs("copy")}>Copy image</MenuItem>
              </Panel>
            )}
          </div>
        </Panel>
      </div>

      {editorOpen && (
        <div className="absolute top-[68px] bottom-4 left-4 z-10 w-[min(380px,calc(100vw-32px))]">
          <EditorPanel
            source={state.source}
            onSource={(source) => update({ source })}
            errors={parsed.errors}
            stats={{ nodes: data.nodes.length, links: data.links.length }}
            onClose={() => setEditorOpen(false)}
            textareaRef={textarea}
          />
        </div>
      )}

      <div className="pointer-events-none absolute top-4 right-4 bottom-20 z-10 flex flex-col items-end">
        <div className="pointer-events-auto flex max-h-full min-h-0">
          {settingsOpen ? (
            <SettingsPanel
              settings={state.settings}
              onSettings={(settings) => update({ settings })}
              groups={state.groups}
              onGroups={(groups) => update({ groups })}
              theme={theme}
              onTheme={(themeId) => update({ themeId })}
              search={search}
              onSearch={setSearch}
              onAnimate={() => renderer?.replay(Math.min(8000, 1500 + data.nodes.length * 40))}
              onClose={() => setSettingsOpen(false)}
            />
          ) : (
            <Panel className="p-1">
              <Button onClick={() => setSettingsOpen(true)} title="Graph settings (,)">
                <GearIcon /> Settings
              </Button>
            </Panel>
          )}
        </div>
      </div>

      <div className="absolute right-4 bottom-4 z-10">
        <Panel className="flex items-center p-1">
          <Button onClick={() => renderer?.zoomBy(1 / 1.4)} title="Zoom out (-)">
            −
          </Button>
          <Button onClick={() => renderer?.zoomToFit()} title="Fit graph (F)">
            Fit
          </Button>
          <Button onClick={() => renderer?.zoomBy(1.4)} title="Zoom in (+)">
            +
          </Button>
          <Divider />
          <Button onClick={() => renderer?.reheat()} title="Shake the layout loose">
            Shake
          </Button>
        </Panel>
      </div>

      {draft && (
        <input
          autoFocus
          placeholder="Node name"
          className="absolute z-30 w-40 -translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--accent)] bg-[var(--panel)] px-2.5 py-1.5 text-center text-xs text-[var(--fg)] shadow-xl outline-none backdrop-blur-xl"
          style={{ left: draft.screen.x, top: draft.screen.y }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addDraftNode(e.currentTarget.value);
            if (e.key === "Escape") setDraft(null);
          }}
          onBlur={(e) => addDraftNode(e.currentTarget.value)}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-medium text-[var(--accent-fg)] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function chromeVars(theme: AppTheme): CSSProperties {
  const { background, accent } = theme.graph;
  const base = theme.light
    ? {
        "--panel": "rgba(255,255,255,0.82)",
        "--fg": "#1f1f1f",
        "--muted": "#6b6b6b",
        "--line": "rgba(0,0,0,0.09)",
        "--line-strong": "rgba(0,0,0,0.18)",
        "--hover": "rgba(0,0,0,0.06)",
        "--input": "rgba(0,0,0,0.04)",
      }
    : {
        "--panel": "rgba(24,24,27,0.78)",
        "--fg": "#e4e4e7",
        "--muted": "#a1a1aa",
        "--line": "rgba(255,255,255,0.08)",
        "--line-strong": "rgba(255,255,255,0.2)",
        "--hover": "rgba(255,255,255,0.08)",
        "--input": "rgba(255,255,255,0.05)",
      };
  return { ...base, "--accent": accent, "--accent-fg": readableOn(accent), background: background ?? undefined } as CSSProperties;
}

/** Black or white, whichever reads better on `hex`. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-[var(--hover)]">
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-[var(--line-strong)]" />;
}

function Logo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-[var(--accent)]">
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.6">
        <line x1="4" y1="4" x2="9" y2="9" />
        <line x1="9" y1="9" x2="13" y2="5" />
        <line x1="9" y1="9" x2="6" y2="13" />
      </g>
      <circle cx="4" cy="4" r="2" fill="currentColor" />
      <circle cx="13" cy="5" r="1.6" fill="currentColor" />
      <circle cx="6" cy="13" r="1.6" fill="currentColor" />
      <circle cx="9" cy="9" r="2.6" fill="currentColor" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
