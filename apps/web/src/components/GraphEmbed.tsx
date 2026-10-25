"use client";

import { parseGraph } from "graph-view";
import { Graph } from "graph-view/react";
import { useEffect, useMemo, useState } from "react";
import { renderData, renderOptions } from "@/lib/render";
import { decodeState, DEFAULT_SETTINGS, encodeState, withDefaults, type AppState } from "@/lib/state";
import { themeById } from "@/lib/themes";

/**
 * The canvas alone, for iframes. Reads a share-link hash (`/embed#…`), or
 * plain text for hand-written URLs: `/embed?source=A->B&theme=paper&arrows`.
 */
export function GraphEmbed() {
  const [state, setState] = useState<AppState | null>(null);
  const [studioUrl, setStudioUrl] = useState("/");

  useEffect(() => {
    const load = async () => {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(window.location.search);
      const source = params.get("source");
      const theme = params.get("theme");
      const next = hash
        ? await decodeState(hash)
        : source !== null
          ? withDefaults({ source, ...(theme ? { themeId: theme } : {}), settings: { ...DEFAULT_SETTINGS, arrows: params.has("arrows") } })
          : null;
      setState(next);
      if (next) setStudioUrl(`/#${hash || (await encodeState(next))}`);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const theme = themeById(state?.themeId ?? "vault");
  const data = useMemo(() => (state ? renderData(parseGraph(state.source).data, state.groups, state.settings, theme) : null), [state, theme]);
  const options = useMemo(() => (state ? renderOptions(state.settings, theme, "select") : null), [state, theme]);

  return (
    <div className="relative h-full overflow-hidden" style={{ background: theme.graph.background ?? undefined, color: theme.graph.text }}>
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
        className="absolute right-2 bottom-2 text-[11px] opacity-50 transition-opacity hover:opacity-100"
      >
        graph ↗
      </a>
    </div>
  );
}
