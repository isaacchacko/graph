export interface GraphNodeInput {
  id: string;
  label?: string;
  /** Overrides the theme's node color. Any CSS color. */
  color?: string;
  /** Multiplies the node's computed radius. */
  size?: number;
  /** Where a new node first appears, in world units. Ignored once placed. */
  x?: number;
  y?: number;
}

export interface GraphLinkInput {
  source: string;
  target: string;
  /** Text drawn at the link's midpoint, e.g. a weight. */
  label?: string;
}

export interface GraphData {
  nodes: GraphNodeInput[];
  links: GraphLinkInput[];
}

export interface ForceSettings {
  /** Pull toward the origin. 0–1. */
  centerForce: number;
  /** Mutual repulsion between every pair of nodes. 0–20. */
  repelForce: number;
  /** Spring stiffness of links. 0–1. */
  linkForce: number;
  /** Resting length of links, in world units. */
  linkDistance: number;
}

export interface Theme {
  /** `null` leaves the canvas transparent. */
  background: string | null;
  node: string;
  link: string;
  text: string;
  /** Color of the hovered node and its links. */
  accent: string;
  fontFamily: string;
}

export interface RendererOptions {
  forces: ForceSettings;
  theme: Theme;
  /** Radius multiplier. */
  nodeSize: number;
  /** Line width multiplier. */
  linkThickness: number;
  /** Label size multiplier. */
  textSize: number;
  arrows: boolean;
  /**
   * Zoom level (log2) below which labels disappear. Higher hides labels
   * until you zoom further in.
   */
  textFadeThreshold: number;
  /** Opacity of nodes outside the focused neighbourhood while hovering. */
  dimOpacity: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RendererEvents {
  nodeClick: { id: string; event: PointerEvent };
  nodeDoubleClick: { id: string; event: MouseEvent };
  nodeHover: { id: string | null };
  backgroundClick: { world: Point; event: PointerEvent };
  backgroundDoubleClick: { world: Point; event: MouseEvent };
  /** Fired when the user drags from one node and releases on another. */
  connect: { source: string; target: string };
  linkClick: { source: string; target: string; event: PointerEvent };
  zoom: { scale: number };
}
