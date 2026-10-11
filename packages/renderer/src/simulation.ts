import { buildQuadtree, type QuadCell } from "./quadtree";
import type { ForceSettings } from "./types";

export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned position while dragged; `null` when free. */
  fx: number | null;
  fy: number | null;
  degree: number;
}

export interface SimLink<N extends SimNode = SimNode> {
  source: N;
  target: N;
  /** Multiplies the resting length. */
  length?: number;
}

const ALPHA_MIN = 0.002;
const ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300);
const VELOCITY_DECAY = 0.4;
const THETA2 = 0.81;
const MIN_DISTANCE2 = 1;
const REPEL_SCALE = 70;
const CENTER_SCALE = 0.03;

/**
 * A velocity-Verlet style force simulation. "Temperature" (`alpha`) scales
 * every force and cools toward `alphaTarget`, so the layout settles and the
 * simulation goes idle once it drops below `ALPHA_MIN`.
 */
export class ForceSimulation<N extends SimNode = SimNode> {
  nodes: N[] = [];
  links: SimLink<N>[] = [];
  alpha = 1;
  alphaTarget = 0;

  constructor(public forces: ForceSettings) {}

  setGraph(nodes: N[], links: SimLink<N>[]): void {
    this.nodes = nodes;
    this.links = links;
    for (const n of nodes) n.degree = 0;
    for (const l of links) {
      l.source.degree++;
      l.target.degree++;
    }
  }

  get active(): boolean {
    return this.alpha >= ALPHA_MIN || this.alphaTarget > 0;
  }

  reheat(alpha = 0.6): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  tick(): void {
    this.alpha += (this.alphaTarget - this.alpha) * ALPHA_DECAY;
    this.applyLinks();
    this.applyRepulsion();
    this.applyCenter();
    for (const n of this.nodes) {
      if (n.fx !== null && n.fy !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= 1 - VELOCITY_DECAY;
      n.vy *= 1 - VELOCITY_DECAY;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  private applyLinks(): void {
    const { linkForce, linkDistance } = this.forces;
    if (linkForce <= 0) return;
    for (const { source: s, target: t, length: scale = 1 } of this.links) {
      if (s === t) continue;
      let dx = t.x + t.vx - s.x - s.vx;
      let dy = t.y + t.vy - s.y - s.vy;
      if (dx === 0 && dy === 0) {
        dx = jiggle();
        dy = jiggle();
      }
      const length = Math.hypot(dx, dy);
      // Hubs would otherwise be yanked around by every spoke at once.
      const stiffness = linkForce / Math.min(s.degree, t.degree);
      const k = ((length - linkDistance * scale) / length) * this.alpha * stiffness;
      dx *= k;
      dy *= k;
      const targetShare = s.degree / (s.degree + t.degree);
      t.vx -= dx * targetShare;
      t.vy -= dy * targetShare;
      s.vx += dx * (1 - targetShare);
      s.vy += dy * (1 - targetShare);
    }
  }

  private applyRepulsion(): void {
    const strength = -this.forces.repelForce * REPEL_SCALE * this.alpha;
    if (strength === 0) return;
    const root = buildQuadtree(this.nodes);
    if (!root) return;
    for (const n of this.nodes) repel(n, root, strength);
  }

  private applyCenter(): void {
    const k = this.forces.centerForce * CENTER_SCALE * this.alpha;
    if (k === 0) return;
    for (const n of this.nodes) {
      n.vx -= n.x * k;
      n.vy -= n.y * k;
    }
  }
}

function repel<N extends SimNode>(node: N, cell: QuadCell<N>, strength: number): void {
  if (cell.mass === 0) return;
  let dx = cell.cx - node.x;
  let dy = cell.cy - node.y;
  let d2 = dx * dx + dy * dy;

  if (cell.isLeaf) {
    for (const other of cell.bodies!) {
      if (other === node) continue;
      dx = other.x - node.x;
      dy = other.y - node.y;
      d2 = dx * dx + dy * dy;
      if (d2 === 0) {
        dx = jiggle();
        dy = jiggle();
        d2 = dx * dx + dy * dy;
      }
      pushApart(node, dx, dy, d2, strength);
    }
    return;
  }

  if ((cell.size * cell.size) / THETA2 < d2) {
    pushApart(node, dx, dy, d2, strength * cell.mass);
    return;
  }
  for (const child of cell.children!) if (child) repel(node, child, strength);
}

function pushApart(node: SimNode, dx: number, dy: number, d2: number, strength: number): void {
  if (d2 < MIN_DISTANCE2) d2 = Math.sqrt(MIN_DISTANCE2 * d2);
  const w = strength / d2;
  node.vx += dx * w;
  node.vy += dy * w;
}

function jiggle(): number {
  return (Math.random() - 0.5) * 1e-6;
}
