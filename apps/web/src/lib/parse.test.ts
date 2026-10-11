import { describe, expect, it } from "vitest";
import { formatName, parseGraph } from "./parse";

const ids = (src: string) => parseGraph(src).data.nodes.map((n) => n.id);
const links = (src: string) => parseGraph(src).data.links.map((l) => `${l.source}>${l.target}`);

describe("parseGraph", () => {
  it("parses chains and fan-outs", () => {
    expect(links("A -> B, C -> D")).toEqual(["A>B", "A>C", "B>D", "C>D"]);
  });

  it("keeps first-appearance order and dedupes nodes", () => {
    expect(ids("B -> A\nA -> C\nD")).toEqual(["B", "A", "C", "D"]);
  });

  it("understands reverse, undirected and bidirectional arrows", () => {
    expect(links("A <- B")).toEqual(["B>A"]);
    expect(links("A -- B")).toEqual(["A>B"]);
    expect(links("A <-> B")).toEqual(["A>B", "B>A"]);
  });

  it("reads colour and size props wherever a node appears", () => {
    const { nodes } = parseGraph("Sun {gold 3} -> Earth\nEarth {#4af}").data;
    expect(nodes).toEqual([
      { id: "Sun", color: "gold", size: 3 },
      { id: "Earth", color: "#4af" },
    ]);
  });

  it("allows quoted names with separators in them", () => {
    expect(ids('"Acme, Inc." -> "a->b"')).toEqual(["Acme, Inc.", "a->b"]);
  });

  it("skips comments and blank lines", () => {
    expect(ids("# heading\n\n// note\nA")).toEqual(["A"]);
  });

  it("reports bad lines without losing the good ones", () => {
    const { data, errors } = parseGraph("A -> B\n -> C\n\"oops");
    expect(data.nodes.map((n) => n.id)).toEqual(["A", "B"]);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("round-trips names through formatName", () => {
    for (const name of ["plain", "Acme, Inc.", "a -> b", "{x}", "#tag"]) {
      expect(ids(`${formatName(name)} -> z`)[0]).toBe(name);
    }
  });
});
