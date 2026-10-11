import { DEFAULT_SETTINGS, type Settings } from "./state";

export type PresetId = "obsidian" | "scc" | "components" | "relaxation" | "bfs" | "degree" | "fruchterman-reingold" | "dag";

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  settings: Settings;
}

const base = DEFAULT_SETTINGS;

/** Settings bundles tuned for looking at a graph a particular way. */
export const PRESETS: Preset[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    description: "The classic look: soft forces, no arrows, plain colours.",
    settings: base,
  },
  {
    id: "scc",
    name: "Strongly connected components",
    description: "Arrows on. Every cycle-bound SCC (Tarjan) gets its own colour and short stiff springs pull it into a knot; nodes on no cycle stay plain.",
    settings: {
      ...base,
      arrows: true,
      colorBy: "scc",
      forces: { centerForce: 0.3, repelForce: 9, linkForce: 1, linkDistance: 55 },
    },
  },
  {
    id: "components",
    name: "Connected components",
    description: "Ignores direction and colours each weakly connected component, with strong repulsion so the islands drift apart.",
    settings: {
      ...base,
      colorBy: "components",
      forces: { centerForce: 0.12, repelForce: 16, linkForce: 1, linkDistance: 70 },
    },
  },
  {
    id: "relaxation",
    name: "Edge relaxation",
    description:
      "Each weighted edge relaxes toward a length proportional to its weight, so the layout approximates shortest-path distances. Weights stay readable. Try it on a Dijkstra or Bellman–Ford example.",
    settings: {
      ...base,
      arrows: true,
      weightsAsLength: true,
      textFadeThreshold: -1.5,
      linkThickness: 1.4,
      forces: { centerForce: 0.15, repelForce: 3, linkForce: 1, linkDistance: 110 },
    },
  },
  {
    id: "bfs",
    name: "BFS layers",
    description: "Colours each BFS layer (hop distance from the first node written) differently, on a spread-out, tree-friendly layout.",
    settings: {
      ...base,
      colorBy: "depth",
      forces: { centerForce: 0.05, repelForce: 14, linkForce: 1, linkDistance: 60 },
    },
  },
  {
    id: "dag",
    name: "DAG / dependency graph",
    description: "Arrows on, strong repulsion and short links, so build graphs, course prerequisites and call graphs fan out cleanly.",
    settings: {
      ...base,
      arrows: true,
      linkThickness: 1.2,
      forces: { centerForce: 0.08, repelForce: 18, linkForce: 0.9, linkDistance: 70 },
    },
  },
  {
    id: "degree",
    name: "Degree centrality",
    description: "Ramps colour by degree on top of degree-scaled node size, so hubs pop.",
    settings: {
      ...base,
      colorBy: "degree",
      nodeSize: 1.6,
      forces: { centerForce: 0.4, repelForce: 11, linkForce: 0.8, linkDistance: 90 },
    },
  },
  {
    id: "fruchterman-reingold",
    name: "Fruchterman–Reingold",
    description: "Balanced attraction and repulsion around a single ideal edge length, with a light centre pull: the textbook spring embedder.",
    settings: {
      ...base,
      forces: { centerForce: 0.1, repelForce: 7, linkForce: 0.6, linkDistance: 120 },
    },
  },
];

/** The preset whose settings match exactly, if any. */
export function matchingPreset(settings: Settings): Preset | undefined {
  // Orphans is a filter, not part of a preset's look.
  const key = (s: Settings) => JSON.stringify({ ...s, showOrphans: true });
  return PRESETS.find((p) => key(p.settings) === key(settings));
}

export function presetById(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id)!;
}
