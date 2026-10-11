"use client";

import type { Ref } from "react";
import { Button, Panel } from "./controls";
import type { ParseError } from "@/lib/parse";
import { TEMPLATES } from "@/lib/templates";

interface Props {
  source: string;
  onSource: (source: string) => void;
  errors: ParseError[];
  stats: { nodes: number; links: number };
  onClose: () => void;
  textareaRef: Ref<HTMLTextAreaElement>;
}

export function EditorPanel({ source, onSource, errors, stats, onClose, textareaRef }: Props) {
  return (
    <Panel className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2">
        <span className="text-[13px] font-semibold">Source</span>
        <select
          value=""
          onChange={(e) => {
            const template = TEMPLATES.find((t) => t.id === e.target.value);
            if (template) onSource(template.source());
          }}
          className="ml-auto cursor-pointer rounded-md border border-[var(--line)] bg-[var(--input)] px-2 py-1 text-xs outline-none hover:border-[var(--accent)]"
        >
          <option value="" disabled>
            Templates…
          </option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button onClick={() => onSource("")} title="Clear everything">
          Clear
        </Button>
        <Button onClick={onClose} title="Hide editor">
          ✕
        </Button>
      </div>

      <textarea
        ref={textareaRef}
        value={source}
        onChange={(e) => onSource(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        placeholder={"Alice -> Bob, Carol\nBob -> Dave\nCarol {tomato 2}"}
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-[12.5px] leading-[1.6] outline-none placeholder:text-[var(--muted)]"
      />

      {errors.length > 0 && (
        <ul className="max-h-24 overflow-y-auto border-t border-[var(--line)] px-3 py-2 font-mono text-[11px] text-[#f87171]">
          {errors.map((e) => (
            <li key={e.line}>
              line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-2 text-[11px] text-[var(--muted)]">
        <span>
          <code className="text-[var(--fg)]">-&gt;</code> link · <code className="text-[var(--fg)]">,</code> many ·{" "}
          <code className="text-[var(--fg)]">{"{red 2}"}</code> style
        </span>
        <span className="tabular-nums">
          {stats.nodes} nodes · {stats.links} links
        </span>
      </div>
    </Panel>
  );
}
