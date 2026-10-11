"use client";

import { useState, type ReactNode } from "react";

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-[var(--line)] first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--fg)] hover:text-[var(--accent)]"
      >
        <Chevron open={open} />
        {title}
      </button>
      {open && <div className="space-y-3 px-3 pb-3.5">{children}</div>}
    </section>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(+v.toFixed(2)),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider w-full"
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs text-[var(--muted)]">
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-8 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[14px]" : ""}`}
        />
      </button>
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "ghost" | "solid";
  title?: string;
  className?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110"
      : "text-[var(--fg)] hover:bg-[var(--hover)]";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--fg)] shadow-2xl shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
