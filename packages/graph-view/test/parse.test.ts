import { describe, expect, it } from "vitest";
import { formatName, parseGraph } from "../src/parse";

const ids = (src: string) => parseGraph(src).data.nodes.map((n) => n.id);
const links = (src: string) => parseGraph(src).data.links.map((l) => `${l.source}>${l.target}${l.label ? `=${l.label}` : ""}`);

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

  it("reads weights on any arrow", () => {
    expect(links("A -(3)-> B")).toEqual(["A>B=3"]);
    expect(links("A <-(x y)- B")).toEqual(["B>A=x y"]);
    expect(links("A -(2.5)- B -> C")).toEqual(["A>B=2.5", "B>C"]);
  });

  it("lets the last statement of a link decide its weight", () => {
    expect(links("A -(3)-> B\nA -> B")).toEqual(["A>B"]);
    expect(links("A -> B\nA -(4)-> B")).toEqual(["A>B=4"]);
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

  it("records where names and single-pair arrows are written", () => {
    const parsed = parseGraph('  "x y" {red} -> B, C\nB -(2)-> C');
    expect(parsed.names.get("x y")).toEqual([{ line: 0, start: 2, end: 7 }]);
    expect(parsed.arrows.get("x y\u0000B")).toBeNull();
    expect(parsed.arrows.get("B\u0000C")).toEqual({ line: 1, start: 2, end: 8, left: false, right: true });
  });

  it("round-trips names through formatName", () => {
    for (const name of ["plain", "Acme, Inc.", "a -> b", "{x}", "#tag", "f(x)"]) {
      expect(ids(`${formatName(name)} -> z`)[0]).toBe(name);
    }
  });
});
