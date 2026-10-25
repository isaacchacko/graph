/**
 * Barnes–Hut quadtree. Each cell aggregates the count and centre of mass of
 * the bodies under it so distant clusters can be treated as a single body.
 */

export interface Body {
  x: number;
  y: number;
}

const MAX_DEPTH = 24;

export class QuadCell<T extends Body> {
  mass = 0;
  cx = 0;
  cy = 0;
  bodies: T[] | null = null;
  children: (QuadCell<T> | null)[] | null = null;

  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly size: number,
  ) {}

  get isLeaf(): boolean {
    return this.children === null;
  }

  insert(body: T, depth = 0): void {
    if (this.children) {
      this.childFor(body).insert(body, depth + 1);
      return;
    }
    if (!this.bodies) {
      this.bodies = [body];
      return;
    }
    const first = this.bodies[0];
    const coincident = first.x === body.x && first.y === body.y;
    if (coincident || depth >= MAX_DEPTH) {
      this.bodies.push(body);
      return;
    }
    const existing = this.bodies;
    this.bodies = null;
    this.children = [null, null, null, null];
    for (const b of existing) this.childFor(b).insert(b, depth + 1);
    this.childFor(body).insert(body, depth + 1);
  }

  private childFor(body: Body): QuadCell<T> {
    const half = this.size / 2;
    const right = body.x >= this.x0 + half ? 1 : 0;
    const bottom = body.y >= this.y0 + half ? 1 : 0;
    const i = bottom * 2 + right;
    const children = this.children!;
    return (children[i] ??= new QuadCell<T>(
      this.x0 + right * half,
      this.y0 + bottom * half,
      half,
    ));
  }

  /** Fills in `mass`, `cx`, `cy` bottom-up. Call once after all inserts. */
  accumulate(): void {
    let mass = 0;
    let sx = 0;
    let sy = 0;
    if (this.children) {
      for (const child of this.children) {
        if (!child) continue;
        child.accumulate();
        mass += child.mass;
        sx += child.cx * child.mass;
        sy += child.cy * child.mass;
      }
    } else if (this.bodies) {
      for (const b of this.bodies) {
        sx += b.x;
        sy += b.y;
      }
      mass = this.bodies.length;
    }
    this.mass = mass;
    this.cx = mass ? sx / mass : 0;
    this.cy = mass ? sy / mass : 0;
  }
}

export function buildQuadtree<T extends Body>(bodies: readonly T[]): QuadCell<T> | null {
  if (bodies.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bodies) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x > maxX) maxX = b.x;
    if (b.y > maxY) maxY = b.y;
  }
  const size = Math.max(maxX - minX, maxY - minY, 1) * 1.0001;
  const root = new QuadCell<T>(minX, minY, size);
  for (const b of bodies) root.insert(b);
  root.accumulate();
  return root;
}
