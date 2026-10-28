"use client";

import { parseGraph } from "@isaacchacko/graph";
import { Graph } from "@isaacchacko/graph/react";
import { useEffect, useMemo, useState } from "react";
import { AUTO_THEME, embedTheme, shareUrl } from "@/lib/embed";
import { renderData, renderOptions } from "@/lib/render";
import { decodeState, DEFAULT_SETTINGS, encodeState, withDefaults, type AppState } from "@/lib/state";

const DARK_SCHEME = "(prefers-color-scheme: dark)";

/**
 * The canvas alone, for iframes. Reads a share-link hash (`/embed#…`), or
 * plain text for hand-written URLs: `/embed?source=A->B&theme=paper&arrows`.
 * `?theme=` overrides the graph's theme; `?theme=auto` follows the page's light/dark.
 * `?no-zoom` lets the wheel scroll the embedding page instead of zooming.
 * Never touches storage or history, so the URL stays reloadable and the visitor's own graph stays theirs.
 */
export function GraphEmbed() {
  const [state, setState] = useState<AppState | null>(null);
  const [themeParam, setThemeParam] = useState<string | null>(null);
  const [zoom, setZoom] = useState(true);
  const [prefersDark, setPrefersDark] = useState(false);
  const [studioUrl, setStudioUrl] = useState("/");

  useEffect(() => {
    const query = window.matchMedia(DARK_SCHEME);
    const sync = () => setPrefersDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const load = async () => {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(window.location.search);
      const source = params.get("source");
      const theme = params.get("theme");
      const next = hash
        ? await decodeState(hash)
        : source !== null
          ? withDefaults({ source, ...(theme && theme !== AUTO_THEME ? { themeId: theme } : {}), settings: { ...DEFAULT_SETTINGS, arrows: params.has("arrows") } })
          : null;
      setState(next);
      setThemeParam(theme);
      setZoom(!params.has("no-zoom"));
      if (next) setStudioUrl(shareUrl("", hash || (await encodeState(next))));
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const theme = embedTheme(state?.themeId ?? "vault", themeParam, prefersDark);
  const data = useMemo(() => (state ? renderData(parseGraph(state.source).data, state.groups, state.settings, theme) : null), [state, theme]);
  const options = useMemo(() => (state ? { ...renderOptions(state.settings, theme, "select"), zoom } : null), [state, theme, zoom]);

  return (
    <div data-embed className="relative h-full overflow-hidden" style={{ background: theme.graph.background ?? undefined, color: theme.graph.text }}>
      {data && options && <Graph className="absolute inset-0" data={data} options={options} />}
      {!state && (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm opacity-60">
          Nothing to show. Make a graph, then use “Copy embed code”.
        </div>
      )}
      <a
        href={studioUrl}
        target="_blank"
        rel="noopener"
        title="Open in graph"
        className="absolute right-2 bottom-2 text-[11px] opacity-50 transition-opacity hover:opacity-100"
      >
        graph ↗
      </a>
    </div>
  );
}
