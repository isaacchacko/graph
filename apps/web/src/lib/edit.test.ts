import { describe, expect, it } from "vitest";
import { appendLine, renameNode, setLinkWeight, uniqueName } from "./edit";
import { parseGraph } from "./parse";

const rename = (src: string, from: string, to: string) => renameNode(src, parseGraph(src), from, to);
const weigh = (src: string, from: string, to: string, w: string) => setLinkWeight(src, parseGraph(src), from, to, w);

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

describe("helpers", () => {
  it("appends lines without doubling blank lines", () => {
    expect(appendLine("", "A")).toBe("A\n");
    expect(appendLine("A\n\n", "B")).toBe("A\nB\n");
  });

  it("finds an unused name", () => {
    expect(uniqueName(["Untitled", "Untitled 2"])).toBe("Untitled 3");
  });
});
