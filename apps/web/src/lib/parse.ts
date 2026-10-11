import type { GraphData, GraphNodeInput } from "@graph/renderer";

/**
 * The graph language, one statement per line:
 *
 *   Alice -> Bob                  link
 *   Alice -> Bob, Carol           fan out
 *   Alice -> Bob -> Carol         chain
 *   Alice <- Bob    Alice -- Bob  reverse / undirected
 *   Dave                          lone node
 *   Sun {gold 3}                  colour and size, anywhere the node appears
 *   "Acme, Inc." -> Bob           quote names that contain , { } or arrows
 *   # comment    // comment
 */

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  data: GraphData;
  errors: ParseError[];
}

type Arrow = "->" | "<-" | "--" | "<->";
const ARROWS: Arrow[] = ["<->", "->", "<-", "--"];

interface NodeRef {
  name: string;
  color?: string;
  size?: number;
}

export function parseGraph(source: string): ParseResult {
  const nodes = new Map<string, GraphNodeInput>();
  const links: GraphData["links"] = [];
  const errors: ParseError[] = [];

  const touch = (ref: NodeRef) => {
    let node = nodes.get(ref.name);
    if (!node) nodes.set(ref.name, (node = { id: ref.name }));
    if (ref.color) node.color = ref.color;
    if (ref.size) node.size = ref.size;
  };

  source.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    try {
      const { groups, arrows } = splitStatement(line);
      groups.forEach((group) => group.forEach(touch));
      arrows.forEach((arrow, k) => {
        for (const a of groups[k]) {
          for (const b of groups[k + 1]) {
            if (arrow === "<-") links.push({ source: b.name, target: a.name });
            else links.push({ source: a.name, target: b.name });
            if (arrow === "<->") links.push({ source: b.name, target: a.name });
          }
        }
      });
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message });
    }
  });

  return { data: { nodes: [...nodes.values()], links }, errors };
}

function splitStatement(line: string): { groups: NodeRef[][]; arrows: Arrow[] } {
  const segments: string[] = [];
  const arrows: Arrow[] = [];
  let current = "";
  let quoted = false;
  let braces = 0;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === "{") braces++;
    else if (!quoted && c === "}") braces = Math.max(0, braces - 1);
    if (!quoted && braces === 0) {
      const arrow = ARROWS.find((a) => line.startsWith(a, i));
      if (arrow) {
        segments.push(current);
        arrows.push(arrow);
        current = "";
        i += arrow.length - 1;
        continue;
      }
    }
    current += c;
  }
  if (quoted) throw new Error("Unclosed quote");
  segments.push(current);

  const groups = segments.map((segment, k) => {
    const refs = splitList(segment).map(parseRef);
    if (refs.length === 0) {
      throw new Error(k === 0 ? "Missing a node before the arrow" : "Missing a node after the arrow");
    }
    return refs;
  });
  return { groups, arrows };
}

function splitList(segment: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let braces = 0;
  for (const c of segment) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === "{") braces++;
    else if (!quoted && c === "}") braces = Math.max(0, braces - 1);
    if (c === "," && !quoted && braces === 0) {
      parts.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseRef(text: string): NodeRef {
  let name = text;
  let props = "";
  const brace = findPropsStart(text);
  if (brace >= 0) {
    if (!text.endsWith("}")) throw new Error(`Unclosed { in "${text}"`);
    name = text.slice(0, brace).trim();
    props = text.slice(brace + 1, -1);
  }
  if (name.startsWith('"') && name.endsWith('"') && name.length >= 2) name = name.slice(1, -1);
  if (!name) throw new Error("Empty node name");

  const ref: NodeRef = { name };
  for (const token of props.split(/[\s,]+/).filter(Boolean)) {
    const size = /^(\d*\.?\d+)x?$/.exec(token);
    if (size) ref.size = Math.min(20, Math.max(0.1, Number(size[1])));
    else ref.color = token;
  }
  return ref;
}

function findPropsStart(text: string): number {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    else if (text[i] === "{" && !quoted) return i;
  }
  return -1;
}

/** Quotes a name only if the parser would otherwise misread it. */
export function formatName(name: string): string {
  return /[",{}]|->|<-|--|^\s|\s$|^#|^\/\//.test(name) ? `"${name.replaceAll('"', "'")}"` : name;
}
