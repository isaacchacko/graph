import { describe, expect, it } from "vitest";
import { parseGraph, renderSvg, settle } from "../src/index";

const data = parseGraph("Sun {gold 3} -> Earth -> Moon\nEarth -(2)-> Mars\nPluto").data;

describe("settle", () => {
  it("places every node, without a DOM", () => {
    const settled = settle(data);
    expect(settled.nodes.map((n) => n.id)).toEqual(["Sun", "Earth", "Moon", "Mars", "Pluto"]);
    for (const n of settled.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    expect(settled.links).toBe(data.links);
  });

  it("spreads linked nodes out to about the link distance", () => {
    const at = new Map(settle(data).nodes.map((n) => [n.id, n]));
    const d = Math.hypot(at.get("Earth")!.x! - at.get("Moon")!.x!, at.get("Earth")!.y! - at.get("Moon")!.y!);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(400);
  });

  it("is deterministic", () => {
    expect(settle(data)).toEqual(settle(data));
  });
});

describe("renderSvg", () => {
  it("draws every node, link label and arrow", () => {
    const svg = renderSvg(data, { arrows: true });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/<circle /g)).toHaveLength(5);
    expect(svg.match(/<path /g)).toHaveLength(3);
    expect(svg).toContain(">2</text>");
    expect(svg).toContain('fill="gold"');
  });

  it("keeps given positions", () => {
    const svg = renderSvg({ nodes: [{ id: "a", x: 10, y: 20 }], links: [] });
    expect(svg).toContain('cx="10" cy="20"');
  });

  it("paints CSS variables with style, which attributes can't hold", () => {
    const svg = renderSvg(data, { theme: { background: null, node: "var(--graph-node, #888)" } });
    expect(svg).toContain('style="fill:var(--graph-node, #888)"');
    expect(svg).not.toContain('fill="var(');
  });
});
