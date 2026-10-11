"use client";

import type { ForceSettings } from "@graph/renderer";
import { Button, Panel, Section, Slider, Toggle } from "./controls";
import { DEFAULT_SETTINGS, type Group, type Settings } from "@/lib/state";
import { THEMES, type AppTheme } from "@/lib/themes";

interface Props {
  settings: Settings;
  onSettings: (s: Settings) => void;
  groups: Group[];
  onGroups: (g: Group[]) => void;
  theme: AppTheme;
  onTheme: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
  onAnimate: () => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onSettings, groups, onGroups, theme, onTheme, search, onSearch, onAnimate, onClose }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...settings, [key]: value });
  const force = <K extends keyof ForceSettings>(key: K, value: number) => set("forces", { ...settings.forces, [key]: value });
  const updateGroup = (i: number, patch: Partial<Group>) => onGroups(groups.map((g, k) => (k === i ? { ...g, ...patch } : g)));

  return (
    <Panel className="flex max-h-full w-[280px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <span className="text-[13px] font-semibold">Graph settings</span>
        <div className="flex">
          <Button onClick={() => onSettings(DEFAULT_SETTINGS)} title="Restore defaults">
            <ResetIcon />
          </Button>
          <Button onClick={onClose} title="Close">
            ✕
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <Section title="Filters">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search nodes…  (or /regex/)"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--input)] px-2.5 py-1.5 text-xs outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
          <Toggle label="Orphans" checked={settings.showOrphans} onChange={(v) => set("showOrphans", v)} />
        </Section>

        <Section title="Groups">
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={g.query}
                onChange={(e) => updateGroup(i, { query: e.target.value })}
                placeholder="Match text or /regex/"
                className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--input)] px-2.5 py-1.5 text-xs outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              />
              <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border border-[var(--line)]" style={{ background: g.color }}>
                <input type="color" value={g.color} onChange={(e) => updateGroup(i, { color: e.target.value })} className="absolute inset-0 opacity-0" />
              </label>
              <button onClick={() => onGroups(groups.filter((_, k) => k !== i))} className="text-xs text-[var(--muted)] hover:text-[var(--fg)]" title="Remove group">
                ✕
              </button>
            </div>
          ))}
          <Button
            variant="solid"
            className="w-full"
            onClick={() => onGroups([...groups, { query: "", color: theme.palette[groups.length % theme.palette.length] }])}
          >
            New group
          </Button>
        </Section>

        <Section title="Display">
          <Toggle label="Arrows" checked={settings.arrows} onChange={(v) => set("arrows", v)} />
          <Slider label="Text fade threshold" value={settings.textFadeThreshold} min={-3} max={3} step={0.1} onChange={(v) => set("textFadeThreshold", v)} />
          <Slider label="Text size" value={settings.textSize} min={0.5} max={3} step={0.05} onChange={(v) => set("textSize", v)} />
          <Slider label="Node size" value={settings.nodeSize} min={0.2} max={5} step={0.05} onChange={(v) => set("nodeSize", v)} />
          <Slider label="Link thickness" value={settings.linkThickness} min={0.2} max={5} step={0.05} onChange={(v) => set("linkThickness", v)} />
          <Button variant="solid" className="w-full" onClick={onAnimate}>
            Animate
          </Button>
        </Section>

        <Section title="Forces">
          <Slider label="Center force" value={settings.forces.centerForce} min={0} max={1} step={0.01} onChange={(v) => force("centerForce", v)} />
          <Slider label="Repel force" value={settings.forces.repelForce} min={0} max={20} step={0.1} onChange={(v) => force("repelForce", v)} />
          <Slider label="Link force" value={settings.forces.linkForce} min={0} max={1} step={0.01} onChange={(v) => force("linkForce", v)} />
          <Slider label="Link distance" value={settings.forces.linkDistance} min={20} max={300} step={1} onChange={(v) => force("linkDistance", v)} format={(v) => String(Math.round(v))} />
        </Section>

        <Section title="Theme">
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => onTheme(t.id)}
                title={t.name}
                className={`group flex flex-col items-center gap-1 rounded-lg p-1 text-[10px] ${t.id === theme.id ? "ring-2 ring-[var(--accent)]" : "hover:bg-[var(--hover)]"}`}
              >
                <ThemeSwatch theme={t} />
                <span className="text-[var(--muted)] group-hover:text-[var(--fg)]">{t.name}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </Panel>
  );
}

function ThemeSwatch({ theme }: { theme: AppTheme }) {
  const { background, node, link, accent } = theme.graph;
  return (
    <svg viewBox="0 0 40 28" className="h-7 w-10 rounded-md border border-[var(--line)]">
      <rect width="40" height="28" fill={background ?? "transparent"} />
      <g stroke={link} strokeWidth="1.2">
        <line x1="10" y1="9" x2="22" y2="16" />
        <line x1="22" y1="16" x2="32" y2="8" />
        <line x1="22" y1="16" x2="17" y2="23" />
      </g>
      <circle cx="10" cy="9" r="2.5" fill={node} />
      <circle cx="32" cy="8" r="2.2" fill={node} />
      <circle cx="17" cy="23" r="2.2" fill={node} />
      <circle cx="22" cy="16" r="3.5" fill={accent} />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
      <path d="M2.5 2.5v3h3" />
    </svg>
  );
}
