"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { RENDERER_EVENTS, resolveTheme, type ThemeInput } from "./defaults";
import { parseGraph } from "./parse";
import { GraphRenderer, type PartialOptions } from "./renderer";
import type { GraphData, RendererEvents, Selection } from "./types";

type Handlers = { [K in keyof RendererEvents as `on${Capitalize<K>}`]?: (e: RendererEvents[K]) => void };

export interface GraphProps extends Handlers {
  /** The graph language, e.g. `"A -> B, C"`. Ignored when `data` is given. */
  source?: string;
  data?: GraphData;
  theme?: ThemeInput;
  options?: PartialOptions;
  /** Emphasise these nodes as if hovered. */
  highlighted?: string[] | null;
  selection?: Selection;
  /** Called with the renderer once it exists, and with `null` when it is destroyed. */
  onReady?: (renderer: GraphRenderer | null) => void;
  className?: string;
  /** Without a `className` or `style` the graph fills its parent's width and is 400px tall. */
  style?: CSSProperties;
}

const EMPTY: GraphData = { nodes: [], links: [] };

/** An interactive force-directed graph. */
export function Graph({ source, data, theme, options, highlighted = null, selection = null, onReady, className, style, ...handlers }: GraphProps) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<GraphRenderer | null>(null);
  const latest = useRef({ handlers, onReady });

  const graph = useMemo(() => data ?? (source ? parseGraph(source).data : EMPTY), [data, source]);
  const merged = useMemo<PartialOptions>(() => ({ ...options, ...(theme ? { theme: resolveTheme(theme) } : {}) }), [options, theme]);

  useEffect(() => {
    latest.current = { handlers, onReady };
  });

  useEffect(() => {
    const r = new GraphRenderer(container.current!, merged);
    renderer.current = r;
    r.setData(graph);
    const offs = RENDERER_EVENTS.map((event) =>
      r.on(event, (payload) => {
        const key = `on${event[0].toUpperCase()}${event.slice(1)}` as keyof Handlers;
        (latest.current.handlers[key] as ((p: typeof payload) => void) | undefined)?.(payload);
      }),
    );
    latest.current.onReady?.(r);
    return () => {
      offs.forEach((off) => off());
      latest.current.onReady?.(null);
      r.destroy();
      renderer.current = null;
    };
    // Options and data are synced by the effects below; the renderer lives as long as the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderer.current?.setData(graph);
  }, [graph]);

  useEffect(() => {
    renderer.current?.setOptions(merged);
  }, [merged]);

  useEffect(() => {
    renderer.current?.setHighlighted(highlighted);
  }, [highlighted]);

  useEffect(() => {
    renderer.current?.setSelection(selection);
  }, [selection]);

  return <div ref={container} className={className} style={style ?? (className ? undefined : { width: "100%", height: 400 })} />;
}
