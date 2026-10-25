import type { GraphData, GraphLinkInput, GraphNodeInput } from "./types";

/**
 * The graph language, one statement per line:
 *
 *   Alice -> Bob                  link
 *   Alice -> Bob, Carol           fan out
 *   Alice -> Bob -> Carol         chain
 *   Alice <- Bob    Alice -- Bob  reverse / undirected   (<-> both ways)
 *   Alice -(3)-> Bob              weighted link (any arrow: -(3)-, <-(3)-, …)
 *   Dave                          lone node
 *   Sun {gold 3}                  colour and size, anywhere the node appears
 *   "Acme, Inc." -> Bob           quote names that contain , { } ( or arrows
 *   # comment    // comment
 *
 * When a link is stated more than once, the last statement decides its weight.
 */

export interface ParseError {
  line: number;
  message: string;
}

/** A character range within one line: `[start, end)`, line 0-based. */
export interface Span {
  line: number;
  start: number;
  end: number;
}

export interface ArrowSpan extends Span {
  left: boolean;
  right: boolean;
}

export interface ParseResult {
  data: GraphData;
  errors: ParseError[];
  /** Every place each node's name is written, for renaming in place. */
  names: Map<string, Span[]>;
  /**
   * The arrow of each link's last statement, when that arrow joins exactly one
   * pair of nodes and can be rewritten without touching other links.
   */
  arrows: Map<string, ArrowSpan | null>;
  statements: Statement[];
}

export interface NodeRef {
  name: string;
  /** Where the name itself is written (quotes included, props excluded). */
  span: Span;
  /** The whole reference as written, props included. */
  raw: string;
  color?: string;
  size?: number;
}

export interface Arrow extends ArrowSpan {
  text: string;
  weight?: string;
}

/** One line's chain: `groups[k]` is joined to `groups[k + 1]` by `arrows[k]`. */
export interface Statement {
  line: number;
  indent: string;
  groups: NodeRef[][];
  arrows: Arrow[];
}

const ARROW = /<?-\(([^)]*)\)->?|<->|->|<-|--/y;

export function linkKey(source: string, target: string): string {
  return `${source}\u0000${target}`;
}

/** The links one arrow makes between one pair, as `[source, target]`. */
export function arrowLinks(arrow: ArrowSpan, a: string, b: string): [string, string][] {
  if (arrow.left && arrow.right) return [[a, b], [b, a]];
  return arrow.left ? [[b, a]] : [[a, b]];
}

export function parseGraph(source: string): ParseResult {
  const nodes = new Map<string, GraphNodeInput>();
  const links = new Map<string, GraphLinkInput>();
  const names = new Map<string, Span[]>();
  const arrows = new Map<string, ArrowSpan | null>();
  const statements: Statement[] = [];
  const errors: ParseError[] = [];

  const touch = (ref: NodeRef) => {
    let node = nodes.get(ref.name);
    if (!node) nodes.set(ref.name, (node = { id: ref.name }));
    if (ref.color) node.color = ref.color;
    if (ref.size) node.size = ref.size;
    const spans = names.get(ref.name) ?? [];
    spans.push(ref.span);
    names.set(ref.name, spans);
  };

  const link = (from: NodeRef, to: NodeRef, arrow: Arrow, unique: boolean) => {
    const key = linkKey(from.name, to.name);
    // Re-insert so a later statement also moves the link to the end, like the weight it sets.
    links.delete(key);
    links.set(key, { source: from.name, target: to.name, ...(arrow.weight ? { label: arrow.weight } : {}) });
    arrows.set(key, unique ? { line: arrow.line, start: arrow.start, end: arrow.end, left: arrow.left, right: arrow.right } : null);
  };

  source.split(/\r?\n/).forEach((raw, line) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;
    try {
      const { groups, arrows: lineArrows } = parseStatement(raw, line);
      statements.push({ line, indent: raw.slice(0, raw.length - raw.trimStart().length), groups, arrows: lineArrows });
      groups.forEach((group) => group.forEach(touch));
      lineArrows.forEach((arrow, k) => {
        const unique = groups[k].length === 1 && groups[k + 1].length === 1;
        for (const a of groups[k]) {
          for (const b of groups[k + 1]) {
            for (const [from, to] of arrowLinks(arrow, a.name, b.name)) link(byName(from, a, b), byName(to, a, b), arrow, unique);
          }
        }
      });
    } catch (e) {
      errors.push({ line: line + 1, message: (e as Error).message });
    }
  });

  return { data: { nodes: [...nodes.values()], links: [...links.values()] }, errors, names, arrows, statements };
}

function byName(name: string, a: NodeRef, b: NodeRef): NodeRef {
  return a.name === name ? a : b;
}

function parseStatement(raw: string, line: number): { groups: NodeRef[][]; arrows: Arrow[] } {
  const segments: { start: number; end: number }[] = [];
  const arrows: Arrow[] = [];
  let segmentStart = 0;

  scan(raw, 0, raw.length, (i) => {
    ARROW.lastIndex = i;
    const m = ARROW.exec(raw);
    if (!m) return 0;
    segments.push({ start: segmentStart, end: i });
    const text = m[0];
    const weight = m[1]?.trim();
    arrows.push({
      line,
      start: i,
      end: i + text.length,
      left: text.startsWith("<"),
      right: text.endsWith(">"),
      text,
      weight: weight || undefined,
    });
    segmentStart = i + text.length;
    return text.length;
  });
  segments.push({ start: segmentStart, end: raw.length });

  const groups = segments.map((segment, k) => {
    const refs: NodeRef[] = [];
    let partStart = segment.start;
    scan(raw, segment.start, segment.end, (i) => {
      if (raw[i] !== ",") return 0;
      pushRef(refs, raw, partStart, i, line);
      partStart = i + 1;
      return 1;
    });
    pushRef(refs, raw, partStart, segment.end, line);
    if (refs.length === 0) throw new Error(k === 0 ? "Missing a node before the arrow" : "Missing a node after the arrow");
    return refs;
  });
  return { groups, arrows };
}

/**
 * Walks `raw[start, end)` skipping quoted text and `{…}` props, calling
 * `separator` at every other position. It returns how many characters it
 * consumed (0 when there is no separator there).
 */
function scan(raw: string, start: number, end: number, separator: (i: number) => number): void {
  let quoted = false;
  let braces = 0;
  for (let i = start; i < end; i++) {
    const c = raw[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === "{") braces++;
    else if (!quoted && c === "}") braces = Math.max(0, braces - 1);
    else if (!quoted && braces === 0) {
      const consumed = separator(i);
      if (consumed > 0) i += consumed - 1;
    }
  }
  if (quoted) throw new Error("Unclosed quote");
}

function pushRef(refs: NodeRef[], raw: string, start: number, end: number, line: number): void {
  const text = raw.slice(start, end);
  const body = text.trim();
  if (!body) return;
  const bodyStart = start + (text.length - text.trimStart().length);

  let nameText = body;
  let props = "";
  const brace = findPropsStart(body);
  if (brace >= 0) {
    if (!body.endsWith("}")) throw new Error(`Unclosed { in "${body}"`);
    nameText = body.slice(0, brace).trimEnd();
    props = body.slice(brace + 1, -1);
  }
  let name = nameText;
  if (name.startsWith('"') && name.endsWith('"') && name.length >= 2) name = name.slice(1, -1);
  if (!name) throw new Error("Empty node name");

  const ref: NodeRef = { name, raw: body, span: { line, start: bodyStart, end: bodyStart + nameText.length } };
  for (const token of props.split(/[\s,]+/).filter(Boolean)) {
    const size = /^(\d*\.?\d+)x?$/.exec(token);
    if (size) ref.size = Math.min(20, Math.max(0.1, Number(size[1])));
    else ref.color = token;
  }
  refs.push(ref);
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
  return /[",{}()]|->|<-|--|^\s|\s$|^#|^\/\//.test(name) ? `"${name.replaceAll('"', "'")}"` : name;
}

export function formatArrow(left: boolean, right: boolean, weight?: string): string {
  const w = weight?.replaceAll(")", "").trim();
  if (w) return `${left ? "<" : ""}-(${w})-${right ? ">" : ""}`;
  if (left && right) return "<->";
  if (left) return "<-";
  if (right) return "->";
  return "--";
}
