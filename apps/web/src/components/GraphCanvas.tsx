"use client";

import { GraphRenderer, type GraphData, type PartialOptions, type RendererEvents } from "@graph/renderer";
import { useEffect, useRef } from "react";

type Handlers = { [K in keyof RendererEvents as `on${Capitalize<K>}`]?: (e: RendererEvents[K]) => void };

interface Props extends Handlers {
  data: GraphData;
  options: PartialOptions;
  highlighted: string[] | null;
  onReady?: (renderer: GraphRenderer | null) => void;
  className?: string;
}

const EVENTS: (keyof RendererEvents)[] = [
  "nodeClick",
  "nodeDoubleClick",
  "nodeHover",
  "backgroundClick",
  "backgroundDoubleClick",
  "connect",
  "linkClick",
  "zoom",
];

export function GraphCanvas({ data, options, highlighted, onReady, className, ...handlers }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<GraphRenderer | null>(null);
  const latest = useRef({ handlers, onReady });

  useEffect(() => {
    latest.current = { handlers, onReady };
  });

  useEffect(() => {
    const r = new GraphRenderer(container.current!, options);
    renderer.current = r;
    const offs = EVENTS.map((event) =>
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
    renderer.current?.setData(data);
  }, [data]);

  useEffect(() => {
    renderer.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    renderer.current?.setHighlighted(highlighted);
  }, [highlighted]);

  return <div ref={container} className={className} />;
}
