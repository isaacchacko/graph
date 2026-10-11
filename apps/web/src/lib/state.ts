import { DEFAULT_FORCES, type ForceSettings, type GraphData } from "@graph/renderer";

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
}

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

/** Applies group colours (inline colours win) and the orphan filter. */
export function decorate(data: GraphData, groups: Group[], showOrphans: boolean): GraphData {
  let nodes = data.nodes.map((node) => {
    if (node.color) return node;
    const group = groups.find((g) => matchesQuery(node.label ?? node.id, g.query));
    return group ? { ...node, color: group.color } : node;
  });
  if (!showOrphans) {
    const linked = new Set(data.links.flatMap((l) => (l.source === l.target ? [] : [l.source, l.target])));
    nodes = nodes.filter((n) => linked.has(n.id));
  }
  return { nodes, links: data.links };
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
