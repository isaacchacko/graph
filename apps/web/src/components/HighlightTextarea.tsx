"use client";

import { useRef, type ComponentProps, type Ref } from "react";
import { cn } from "@/lib/utils";

interface Props extends Omit<ComponentProps<"textarea">, "ref"> {
  value: string;
  /** `[start, end)` character offsets to mark. */
  ranges: [number, number][];
  textareaRef?: Ref<HTMLTextAreaElement>;
}

// The backdrop must lay text out exactly like the textarea, so they share every metric.
const METRICS = "px-2.5 py-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words border overflow-y-scroll";

/** A textarea that can mark ranges of its text, drawn on a mirrored backdrop behind it. */
export function HighlightTextarea({ value, ranges, textareaRef, className, onScroll, ...props }: Props) {
  const backdrop = useRef<HTMLDivElement>(null);

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  [...ranges]
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, end], i) => {
      if (start < cursor) return;
      pieces.push(value.slice(cursor, start));
      pieces.push(
        <mark key={i} className="bg-primary/35 text-transparent">
          {value.slice(start, end)}
        </mark>,
      );
      cursor = end;
    });
  pieces.push(value.slice(cursor));

  return (
    <div className={cn("relative", className)}>
      <div ref={backdrop} aria-hidden className={cn(METRICS, "pointer-events-none absolute inset-0 border-transparent text-transparent")}>
        {pieces}
        {/* A trailing newline needs a character after it to take up a line. */}
        {"​"}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
          onScroll?.(e);
        }}
        className={cn(
          METRICS,
          "relative block h-64 w-full resize-y border-input bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        {...props}
      />
    </div>
  );
}
