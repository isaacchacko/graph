import { DEFAULT_FORCES, type ForceSettings, type GraphData } from "graph-view";
import { bfsDepth, connectedComponents, degrees, stronglyConnectedComponents } from "./algorithms";

export interface Group {
  query: string;
  color: string;
}

export interface Settings {
  forces: ForceSettings;
  nodeSize: number;
  linkThickness: number;
  textSize: number;
  textFadeThreshold: number;
  arrows: boolean;
  showOrphans: boolean;
  /** Colour nodes by a graph property, under inline and group colours. */
  colorBy: ColorBy;
  /** Give numerically weighted links a resting length proportional to the weight. */
  weightsAsLength: boolean;
}

export type ColorBy = "none" | "components" | "scc" | "depth" | "degree";

export const COLOR_BY: { id: ColorBy; name: string }[] = [
  { id: "none", name: "Nothing" },
  { id: "components", name: "Connected component" },
  { id: "scc", name: "Strongly connected component" },
  { id: "depth", name: "BFS depth" },
  { id: "degree", name: "Degree" },
];

export interface AppState {
  source: string;
  themeId: string;
  groups: Group[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  forces: DEFAULT_FORCES,
  nodeSize: 1,
  linkThickness: 1,
  textSize: 1,
  textFadeThreshold: 0,
  arrows: false,
  showOrphans: true,
  colorBy: "none",
  weightsAsLength: false,
};

export function withDefaults(partial: Partial<AppState> & { source: string }): AppState {
  return {
    themeId: "vault",
    groups: [],
    ...partial,
    settings: {
      ...DEFAULT_SETTINGS,
      ...partial.settings,
      forces: { ...DEFAULT_SETTINGS.forces, ...partial.settings?.forces },
    },
  };
}

/** Case-insensitive substring match, or a regex when written as /pattern/flags. */
export function matchesQuery(label: string, query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  const regex = /^\/(.+)\/([a-z]*)$/.exec(q);
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2]).test(label);
    } catch {
      return false;
    }
  }
  return label.toLowerCase().includes(q.toLowerCase());
}

interface Palette {
  /** Categorical colours, cycled. */
  categories: string[];
  /** Ends of the sequential ramp, low to high. */
  low: string;
  high: string;
}

/**
 * Prepares parsed data for the renderer: colours (inline, then groups, then
 * `colorBy`), the orphan filter, and weight-proportional link lengths.
 */
export function decorate(data: GraphData, groups: Group[], settings: Settings, palette: Palette): GraphData {
  const auto = autoColors(data, settings.colorBy, palette);
  let nodes = data.nodes.map((node) => {
    if (node.color) return node;
    const color = groups.find((g) => matchesQuery(node.label ?? node.id, g.query))?.color ?? auto.get(node.id);
    return color ? { ...node, color } : node;
  });
  if (!settings.showOrphans) {
    const linked = new Set(data.links.flatMap((l) => (l.source === l.target ? [] : [l.source, l.target])));
    nodes = nodes.filter((n) => linked.has(n.id));
  }
  return { nodes, links: settings.weightsAsLength ? withWeightLengths(data.links) : data.links };
}

function autoColors(data: GraphData, colorBy: ColorBy, palette: Palette): Map<string, string> {
  const colors = new Map<string, string>();
  const categorical = (groups: Map<string, number>, skipSingletons: boolean) => {
    const sizes = new Map<number, number>();
    for (const g of groups.values()) sizes.set(g, (sizes.get(g) ?? 0) + 1);
    // Renumber so the colours follow the order components are first written.
    const order = new Map<number, number>();
    for (const [id, g] of groups) {
      if (skipSingletons && sizes.get(g) === 1) continue;
      if (!order.has(g)) order.set(g, order.size);
      colors.set(id, palette.categories[order.get(g)! % palette.categories.length]);
    }
  };
  const sequential = (values: Map<string, number>) => {
    const max = Math.max(1, ...values.values());
    for (const [id, v] of values) colors.set(id, mixHex(palette.low, palette.high, v / max));
  };
  if (colorBy === "components") categorical(connectedComponents(data), false);
  // A node alone in its SCC is on no cycle: leave it plain so the cycles stand out.
  else if (colorBy === "scc") categorical(stronglyConnectedComponents(data), true);
  // Layers are discrete, so each depth gets its own colour.
  else if (colorBy === "depth") for (const [id, d] of bfsDepth(data)) colors.set(id, palette.categories[d % palette.categories.length]);
  else if (colorBy === "degree") sequential(degrees(data));
  return colors;
}

function withWeightLengths(links: GraphData["links"]): GraphData["links"] {
  const weights = links.map((l) => Number(l.label)).filter((w) => Number.isFinite(w) && w > 0);
  if (weights.length === 0) return links;
  const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
  return links.map((l) => {
    const w = Number(l.label);
    return Number.isFinite(w) && w > 0 ? { ...l, length: Math.min(4, Math.max(0.25, w / mean)) } : l;
  });
}

function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return t < 0.5 ? a : b;
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// ── Share links: state → deflate → base64url in the URL hash ─────────────

export async function encodeState(state: AppState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw")),
  ).arrayBuffer();
  return toBase64Url(new Uint8Array(compressed));
}

export async function decodeState(encoded: string): Promise<AppState | null> {
  try {
    const bytes = fromBase64Url(encoded);
    const json = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
    ).text();
    const parsed = JSON.parse(json);
    if (typeof parsed?.source !== "string") return null;
    return withDefaults(parsed);
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
