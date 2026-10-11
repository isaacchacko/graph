import { describe, expect, it } from "vitest";
import { buildQuadtree } from "../src/quadtree";
import { ForceSimulation, type SimNode } from "../src/simulation";
import { DEFAULT_FORCES } from "../src/defaults";

function node(x: number, y: number): SimNode {
  return { x, y, vx: 0, vy: 0, fx: null, fy: null, degree: 0 };
}

function settle(sim: ForceSimulation, maxTicks = 2000): number {
  let ticks = 0;
  while (sim.active && ticks < maxTicks) {
    sim.tick();
    ticks++;
  }
  return ticks;
}

describe("quadtree", () => {
  it("aggregates mass and centre of mass", () => {
    const root = buildQuadtree([node(0, 0), node(10, 0), node(0, 10), node(10, 10)])!;
    expect(root.mass).toBe(4);
    expect(root.cx).toBeCloseTo(5);
    expect(root.cy).toBeCloseTo(5);
  });

  it("keeps coincident bodies in one leaf instead of recursing forever", () => {
    const bodies = Array.from({ length: 50 }, () => node(3, 3));
    const root = buildQuadtree(bodies)!;
    expect(root.mass).toBe(50);
  });
});

describe("ForceSimulation", () => {
  it("settles a linked pair near the link distance", () => {
    const a = node(-1, 0);
    const b = node(1, 0);
    const sim = new ForceSimulation({ ...DEFAULT_FORCES, centerForce: 0, repelForce: 0, linkDistance: 100 });
    sim.setGraph([a, b], [{ source: a, target: b }]);
    settle(sim);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(100, -1);
  });

  it("pushes unlinked nodes apart and stops when cool", () => {
    const nodes = [node(0, 0), node(1, 0), node(0, 1)];
    const sim = new ForceSimulation({ ...DEFAULT_FORCES, centerForce: 0 });
    sim.setGraph(nodes, []);
    const ticks = settle(sim);
    expect(ticks).toBeLessThan(2000);
    expect(sim.active).toBe(false);
    expect(Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)).toBeGreaterThan(20);
  });

  it("holds pinned nodes in place", () => {
    const a = node(0, 0);
    const b = node(5, 0);
    a.fx = 42;
    a.fy = -7;
    const sim = new ForceSimulation(DEFAULT_FORCES);
    sim.setGraph([a, b], [{ source: a, target: b }]);
    for (let i = 0; i < 50; i++) sim.tick();
    expect([a.x, a.y]).toEqual([42, -7]);
  });

  it("counts degree from links", () => {
    const [a, b, c] = [node(0, 0), node(1, 0), node(2, 0)];
    const sim = new ForceSimulation(DEFAULT_FORCES);
    sim.setGraph([a, b, c], [{ source: a, target: b }, { source: a, target: c }]);
    expect([a.degree, b.degree, c.degree]).toEqual([2, 1, 1]);
  });

  it("lays out a few hundred nodes without NaNs", () => {
    const nodes = Array.from({ length: 300 }, (_, i) => node(Math.cos(i) * i, Math.sin(i) * i));
    const links = nodes.slice(1).map((n, i) => ({ source: nodes[Math.floor(i / 3)], target: n }));
    const sim = new ForceSimulation(DEFAULT_FORCES);
    sim.setGraph(nodes, links);
    settle(sim);
    expect(nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });
});
