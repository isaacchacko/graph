import { describe, expect, it } from "vitest";
import { bfsDepth, connectedComponents, degrees, stronglyConnectedComponents } from "./algorithms";
import { parseGraph } from "@isaacchacko/graph";

const groupsOf = (m: Map<string, number>) => {
  const groups = new Map<number, string[]>();
  for (const [id, g] of m) groups.set(g, [...(groups.get(g) ?? []), id]);
  return [...groups.values()].map((g) => g.sort().join("")).sort();
};
const graph = (src: string) => parseGraph(src).data;

describe("algorithms", () => {
  it("finds strongly connected components", () => {
    expect(groupsOf(stronglyConnectedComponents(graph("a -> b -> c -> a\nc -> d -> e -> d\ne -> f")))).toEqual(["abc", "de", "f"]);
  });

  it("handles a long chain without recursion", () => {
    const src = Array.from({ length: 5000 }, (_, i) => `n${i} -> n${i + 1}`).join("\n");
    expect(stronglyConnectedComponents(graph(src)).size).toBe(5001);
  });

  it("finds weakly connected components", () => {
    expect(groupsOf(connectedComponents(graph("a -> b\nc <- d\nd -> b\ne")))).toEqual(["abcd", "e"]);
  });

  it("measures BFS depth from each component's first node, ignoring direction", () => {
    expect(Object.fromEntries(bfsDepth(graph("a -> b -> c\nd -> b\nx")))).toEqual({ a: 0, b: 1, c: 2, d: 2, x: 0 });
  });

  it("counts degree", () => {
    expect(Object.fromEntries(degrees(graph("a -> b, c\nb -> c")))).toEqual({ a: 2, b: 2, c: 2 });
  });
});
