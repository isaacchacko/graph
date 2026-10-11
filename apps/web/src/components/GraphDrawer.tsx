"use client";

import type { ForceSettings, InteractionMode } from "@graph/renderer";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ImageIcon,
  LinkIcon,
  MinusIcon,
  MousePointer2Icon,
  PencilIcon,
  PlusIcon,
  Redo2Icon,
  RotateCcwIcon,
  ScanIcon,
  ShuffleIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import type { Ref } from "react";
import { SliderField, SwitchField } from "./fields";
import { HighlightTextarea } from "./HighlightTextarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ParseError } from "@/lib/parse";
import { matchingPreset, PRESETS, type PresetId } from "@/lib/presets";
import { COLOR_BY, DEFAULT_SETTINGS, type AppState, type ColorBy, type Group, type Settings } from "@/lib/state";
import { TEMPLATES, type Template } from "@/lib/templates";
import { THEMES, type AppTheme } from "@/lib/themes";

export const DRAWER_WIDTH_PX = 360;
export const REPO_URL = "https://github.com/isaacchacko/graph";

export type ExportKind = "png" | "png-transparent" | "svg" | "copy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InteractionMode;
  onMode: (mode: InteractionMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  state: AppState;
  /** `merge` folds rapid changes to the same control into one undo step. */
  update: (patch: Partial<AppState>, merge?: string) => void;
  onTemplate: (template: Template) => void;
  onPreset: (id: PresetId) => void;
  theme: AppTheme;
  errors: ParseError[];
  highlights: [number, number][];
  search: string;
  onSearch: (q: string) => void;
  textareaRef: Ref<HTMLTextAreaElement>;
  onAnimate: () => void;
  onZoom: (action: "in" | "out" | "fit" | "shake") => void;
  onExport: (kind: ExportKind) => void;
  onShare: () => void;
}

export function GraphDrawer(props: Props) {
  const { open, onOpenChange, state, update, theme, errors, search, onSearch } = props;
  const { settings, groups } = state;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update({ settings: { ...settings, [key]: value } }, `settings.${key}`);
  const force = (key: keyof ForceSettings, value: number) =>
    update({ settings: { ...settings, forces: { ...settings.forces, [key]: value } } }, `forces.${key}`);
  const setGroups = (next: Group[], merge?: string) => update({ groups: next }, merge);
  const updateGroup = (i: number, patch: Partial<Group>) =>
    setGroups(
      groups.map((g, k) => (k === i ? { ...g, ...patch } : g)),
      `group.${i}`,
    );
  const preset = matchingPreset(settings);

  return (
    <aside
      style={{ width: `min(${DRAWER_WIDTH_PX}px, calc(100vw - 48px))` }}
      className={`absolute inset-y-0 left-0 z-20 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div
        className={`flex h-full flex-col border-r bg-background/90 text-foreground backdrop-blur-xl transition-shadow duration-300 ${
          open ? "shadow-2xl shadow-black/30" : "shadow-none"
        }`}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">graph</span>
          <Button variant="ghost" size="icon-sm" asChild className="ml-auto">
            <a href={REPO_URL} target="_blank" rel="noreferrer" title="Source on GitHub" aria-label="Source on GitHub">
              <GitHubIcon />
            </a>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["source", "presets"]} className="px-4">
            <Section value="source" title="Source">
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(id) => {
                    const template = TEMPLATES.find((t) => t.id === id);
                    if (template) props.onTemplate(template);
                  }}
                >
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue placeholder="Load a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => update({ source: "" })}>
                  Clear
                </Button>
              </div>
              <HighlightTextarea
                textareaRef={props.textareaRef}
                value={state.source}
                ranges={props.highlights}
                onChange={(e) => update({ source: e.target.value }, "source")}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                placeholder={"Alice -> Bob, Carol\nBob -(3)-> Dave\nCarol {tomato 2}"}
              />
              {errors.length > 0 && (
                <ul className="space-y-0.5 font-mono text-[11px] text-destructive">
                  {errors.map((e) => (
                    <li key={e.line}>
                      line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <Hint keys="A -> B, C">link, fan out</Hint>
                <Hint keys="A -(3)-> B">weighted link</Hint>
                <Hint keys="A {red 2}">colour, size</Hint>
                <Hint keys="V · select">drag nodes, pan</Hint>
                <Hint keys="P · edit">click: new node · drag node→node: edge</Hint>
                <Hint keys="click + type">rename node / weigh edge</Hint>
                <Hint keys="⌫ · right-click">delete node or edge</Hint>
                <Hint keys="⌘Z · ⇧⌘Z">undo · redo</Hint>
              </dl>
            </Section>

            <Section value="presets" title="Presets">
              <Select value={preset?.id ?? "custom"} onValueChange={(id) => id !== "custom" && props.onPreset(id as PresetId)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" disabled>
                    Custom
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {preset?.description ?? "Your own mix. Pick a preset to start from a known setup."}
              </p>
            </Section>

            <Section value="filters" title="Filters">
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search nodes…  (or /regex/)" className="h-8 text-xs" />
              <SwitchField label="Orphans" checked={settings.showOrphans} onChange={(v) => set("showOrphans", v)} />
            </Section>

            <Section value="groups" title="Groups">
              {groups.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={g.query}
                    onChange={(e) => updateGroup(i, { query: e.target.value })}
                    placeholder="Match text or /regex/"
                    className="h-8 min-w-0 flex-1 text-xs"
                  />
                  <label className="relative size-8 shrink-0 cursor-pointer border" style={{ background: g.color }} title="Pick colour">
                    <input type="color" value={g.color} onChange={(e) => updateGroup(i, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                  <Button variant="ghost" size="icon-sm" onClick={() => setGroups(groups.filter((_, k) => k !== i))} title="Remove group">
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setGroups([...groups, { query: "", color: theme.palette[groups.length % theme.palette.length] }])}
              >
                <PlusIcon /> New group
              </Button>
            </Section>

            <Section value="display" title="Display">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-normal text-muted-foreground">Colour by</Label>
                <Select value={settings.colorBy} onValueChange={(v) => set("colorBy", v as ColorBy)}>
                  <SelectTrigger size="sm" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_BY.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SwitchField label="Arrows" checked={settings.arrows} onChange={(v) => set("arrows", v)} />
              <SwitchField label="Weights set edge length" checked={settings.weightsAsLength} onChange={(v) => set("weightsAsLength", v)} />
              <SliderField label="Text fade threshold" value={settings.textFadeThreshold} min={-3} max={3} step={0.1} onChange={(v) => set("textFadeThreshold", v)} />
              <SliderField label="Text size" value={settings.textSize} min={0.5} max={3} step={0.05} onChange={(v) => set("textSize", v)} />
              <SliderField label="Node size" value={settings.nodeSize} min={0.2} max={5} step={0.05} onChange={(v) => set("nodeSize", v)} />
              <SliderField label="Link thickness" value={settings.linkThickness} min={0.2} max={5} step={0.05} onChange={(v) => set("linkThickness", v)} />
              <Button size="sm" className="w-full" onClick={props.onAnimate}>
                Animate
              </Button>
            </Section>

            <Section value="forces" title="Forces">
              <SliderField label="Center force" value={settings.forces.centerForce} min={0} max={1} step={0.01} onChange={(v) => force("centerForce", v)} />
              <SliderField label="Repel force" value={settings.forces.repelForce} min={0} max={20} step={0.1} onChange={(v) => force("repelForce", v)} />
              <SliderField label="Link force" value={settings.forces.linkForce} min={0} max={1} step={0.01} onChange={(v) => force("linkForce", v)} />
              <SliderField
                label="Link distance"
                value={settings.forces.linkDistance}
                min={20}
                max={300}
                step={1}
                onChange={(v) => force("linkDistance", v)}
                format={(v) => String(Math.round(v))}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => update({ settings: { ...DEFAULT_SETTINGS, showOrphans: settings.showOrphans } })}
              >
                <RotateCcwIcon /> Restore defaults
              </Button>
            </Section>

            <Section value="theme" title="Theme">
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => update({ themeId: t.id })}
                    title={t.name}
                    className={`group flex flex-col items-center gap-1 border p-1.5 text-[10px] transition-colors ${
                      t.id === theme.id ? "border-primary" : "border-transparent hover:border-border"
                    }`}
                  >
                    <ThemeSwatch theme={t} />
                    <span className="text-muted-foreground group-hover:text-foreground">{t.name}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section value="view" title="View">
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => props.onZoom("out")} title="Zoom out (-)">
                  <MinusIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onZoom("fit")} title="Fit (F)">
                  <ScanIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onZoom("in")} title="Zoom in (+)">
                  <PlusIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onZoom("shake")} title="Shake the layout loose">
                  <ShuffleIcon />
                </Button>
              </div>
            </Section>

            <Section value="export" title="Export & share">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => props.onExport("png")}>
                  <ImageIcon /> PNG
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onExport("png-transparent")}>
                  <ImageIcon /> PNG, clear
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onExport("svg")}>
                  <ImageIcon /> SVG
                </Button>
                <Button variant="outline" size="sm" onClick={() => props.onExport("copy")}>
                  <CopyIcon /> Copy image
                </Button>
              </div>
              <Button size="sm" className="w-full" onClick={props.onShare}>
                <LinkIcon /> Copy share link
              </Button>
            </Section>
          </Accordion>
        </div>
      </div>

      <div className="absolute top-3 left-full ml-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onOpenChange(!open)}
          title={open ? "Collapse (E)" : "Expand (E)"}
          className="bg-background/90 backdrop-blur-xl"
        >
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </Button>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={props.mode}
          onValueChange={(v) => v && props.onMode(v as InteractionMode)}
          className="bg-background/90 backdrop-blur-xl"
        >
          <ToggleGroupItem value="select" title="Select (V): drag nodes, pan" aria-label="Select mode" className="size-8">
            <MousePointer2Icon />
          </ToggleGroupItem>
          <ToggleGroupItem value="edit" title="Edit (P): add nodes and edges, rename, delete" aria-label="Edit mode" className="size-8">
            <PencilIcon />
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex bg-background/90 backdrop-blur-xl">
          <Button variant="outline" size="icon" onClick={props.onUndo} disabled={!props.canUndo} title="Undo (⌘Z)" aria-label="Undo">
            <Undo2Icon />
          </Button>
          <Button variant="outline" size="icon" onClick={props.onRedo} disabled={!props.canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className="-ml-px">
            <Redo2Icon />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Section({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="py-3 text-[13px] font-semibold hover:no-underline">{title}</AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Hint({ keys, children }: { keys: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono text-foreground">{keys}</dt>
      <dd>{children}</dd>
    </>
  );
}

function ThemeSwatch({ theme }: { theme: AppTheme }) {
  const { background, node, link, accent } = theme.graph;
  return (
    <svg viewBox="0 0 40 28" className="h-7 w-10 border">
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

function Logo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-primary">
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

/** The GitHub mark (lucide no longer ships brand icons). */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
