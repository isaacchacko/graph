import { describe, expect, it } from "vitest";
import { appendLine, deleteLink, deleteNode, renameNode, setLinkWeight } from "./edit";
import { fruitName, FRUITS } from "./fruits";
import { parseGraph } from "graph-view";

const rename = (src: string, from: string, to: string) => renameNode(src, parseGraph(src), from, to);
const weigh = (src: string, from: string, to: string, w: string) => setLinkWeight(src, parseGraph(src), from, to, w);
const dropNode = (src: string, id: string) => deleteNode(src, parseGraph(src), id);
const dropLink = (src: string, from: string, to: string) => deleteLink(src, parseGraph(src), from, to);
const links = (src: string) => parseGraph(src).data.links.map((l) => `${l.source}>${l.target}${l.label ? `=${l.label}` : ""}`).sort();
const nodes = (src: string) => parseGraph(src).data.nodes.map((n) => n.id).sort();

describe("renameNode", () => {
  it("renames every mention and keeps props", () => {
    expect(rename("A {red} -> B\nB -> A, C", "A", "Big one")).toBe("Big one {red} -> B\nB -> Big one, C");
  });

  it("quotes names that need it", () => {
    expect(rename('"x, y" -> B', "x, y", "a, b")).toBe('"a, b" -> B');
  });
});

describe("setLinkWeight", () => {
  it("rewrites a single-pair arrow in place, keeping its direction", () => {
    expect(weigh("A -> B", "A", "B", "3")).toBe("A -(3)-> B");
    expect(weigh("A <- B", "B", "A", "3")).toBe("A <-(3)- B");
    expect(weigh("A -- B", "A", "B", "3")).toBe("A -(3)- B");
    expect(weigh("A -(3)-> B", "A", "B", "")).toBe("A -> B");
  });

  it("restates a link that shares its arrow", () => {
    expect(weigh("A -> B, C", "A", "C", "7")).toBe("A -> B, C\nA -(7)-> C\n");
  });
});

describe("deleteNode", () => {
  it("removes the node and its links but keeps its neighbours", () => {
    const src = dropNode("A -> B -> C\nB {red} -> D\nE", "B");
    expect(nodes(src)).toEqual(["A", "C", "D", "E"]);
    expect(links(src)).toEqual([]);
  });

  it("drops it from lists and keeps the rest of the statement", () => {
    expect(dropNode("A -> B, C, D", "C")).toBe("A -> B, D");
    expect(dropNode("A -> B\nB -> C", "C")).toBe("A -> B");
  });

  it("preserves indentation and other lines", () => {
    expect(dropNode("# hi\n  A -> B -> C", "A")).toBe("# hi\n  B -> C");
  });
});

describe("deleteLink", () => {
  it("cuts a chain at that link and keeps both nodes", () => {
    const src = dropLink("A -> B -> C", "A", "B");
    expect(links(src)).toEqual(["B>C"]);
    expect(nodes(src)).toEqual(["A", "B", "C"]);
  });

  it("restates the other links of a shared arrow, weights included", () => {
    const src = dropLink("A -(2)-> B, C, D", "A", "C");
    expect(links(src)).toEqual(["A>B=2", "A>D=2"]);
    expect(nodes(src)).toEqual(["A", "B", "C", "D"]);
  });

  it("removes one direction of a two-way arrow", () => {
    expect(links(dropLink("A <-> B", "A", "B"))).toEqual(["B>A"]);
  });

  it("does not leave stray lines for nodes that are mentioned elsewhere", () => {
    expect(dropLink("A -> B\nA -> C\nB -> C", "A", "B")).toBe("A -> C\nB -> C");
  });
});

describe("fruitName", () => {
  it("takes the first free fruit, then numbers them", () => {
    expect(fruitName([])).toBe("Apple");
    expect(fruitName(["Apple", "Banana"])).toBe("Cherry");
    expect(fruitName(FRUITS)).toBe("Apple2");
    expect(fruitName([...FRUITS, "Apple2"])).toBe("Banana2");
  });
});

describe("appendLine", () => {
  it("appends without doubling blank lines", () => {
    expect(appendLine("", "A")).toBe("A\n");
    expect(appendLine("A\n\n", "B")).toBe("A\nB\n");
  });
});
