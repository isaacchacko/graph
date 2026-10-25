import { DEFAULT_FORCES, DEFAULT_OPTIONS, mergeOptions } from "./defaults";
import { buildSvg, type ExportOptions } from "./export";
import { newSceneNode, packTight, sceneBounds, type SceneLink, type SceneNode } from "./scene";
import { ForceSimulation } from "./simulation";
import type { ForceSettings, GraphData, PartialOptions } from "./types";

// Graphs without a browser: layout and SVG from the same code the renderer
// runs, for build steps, servers and tests.

/** Enough for any graph to come to rest; the simulation stops itself well before on most. */
const MAX_TICKS = 600;

/**
 * Lays the graph out without drawing it: the renderer's starting spiral and
 * physics, run until the layout comes to rest. Returns the same data with every
 * node's `x` and `y` set (to 0.1 world units). Given to `setData`, the live
 * graph starts from this layout instead of unfolding from scratch.
 */
export function settle(data: GraphData, forces: Partial<ForceSettings> = {}): GraphData {
  const { nodes, links } = buildScene(data);
  packTight(nodes);
  const sim = new ForceSimulation<SceneNode>({ ...DEFAULT_FORCES, ...forces });
  sim.setGraph(nodes, links);
  for (let i = 0; i < MAX_TICKS && sim.active; i++) sim.tick();

  const settled = new Map(nodes.map((n) => [n.id, n]));
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    nodes: data.nodes.map((n) => ({ ...n, x: round(settled.get(n.id)!.x), y: round(settled.get(n.id)!.y) })),
    links: data.links,
  };
}

/**
 * The graph as an SVG string, exactly as `GraphRenderer.toSVG()` would draw it.
 * Nodes without a position are laid out first with {@link settle}. Colours may
 * be CSS variables (`var(--ink, #333)`), so a page's stylesheet can theme it.
 */
export function renderSvg(data: GraphData, options: PartialOptions = {}, exportOptions: ExportOptions = {}): string {
  const merged = mergeOptions(DEFAULT_OPTIONS, options);
  const placed = data.nodes.every((n) => n.x !== undefined && n.y !== undefined) ? data : settle(data, merged.forces);
  const { nodes, links } = buildScene(placed);
  for (const { source, target } of links) {
    source.degree++;
    target.degree++;
  }
  return buildSvg(nodes, links, merged, sceneBounds(nodes, merged), exportOptions);
}

/** Scene nodes and links for `data`, deduplicated the way the renderer does it. */
function buildScene(data: GraphData): { nodes: SceneNode[]; links: SceneLink[] } {
  const byId = new Map<string, SceneNode>();
  for (const input of data.nodes) if (!byId.has(input.id)) byId.set(input.id, newSceneNode(input));
  const links: SceneLink[] = [];
  const seen = new Set<string>();
  for (const input of data.links) {
    const source = byId.get(input.source);
    const target = byId.get(input.target);
    const key = `${input.source}\u0000${input.target}`;
    if (!source || !target || seen.has(key)) continue;
    seen.add(key);
    links.push({ source, target, label: input.label ?? "", length: input.length ?? 1, fade: 1, accent: 0 });
  }
  return { nodes: [...byId.values()], links };
}
