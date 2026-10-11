import { arrowLinks, formatArrow, formatName, linkKey, type Arrow, type NodeRef, type ParseResult, type Span, type Statement } from "./parse";

/** Source edits made from the canvas. Each returns the new source text. */

export function appendLine(source: string, line: string): string {
  const body = source.trimEnd();
  return body ? `${body}\n${line}\n` : `${line}\n`;
}

/** Rewrites every mention of a node, keeping the props written beside it. */
export function renameNode(source: string, parsed: ParseResult, oldId: string, newId: string): string {
  return replaceNameSpans(source, parsed.names.get(oldId) ?? [], newId);
}

export function replaceNameSpans(source: string, spans: Span[], name: string): string {
  return replaceSpans(source, spans.map((span) => ({ span, text: formatName(name) })));
}

/** Sets (or with an empty `weight`, clears) the weight on one link. */
export function setLinkWeight(source: string, parsed: ParseResult, from: string, to: string, weight: string): string {
  const arrow = parsed.arrows.get(linkKey(from, to));
  if (arrow) return replaceSpans(source, [{ span: arrow, text: formatArrow(arrow.left, arrow.right, weight) }]);
  // The link shares its arrow with other links (a fan-out): restate just this one.
  return appendLine(source, `${formatName(from)} ${formatArrow(false, true, weight)} ${formatName(to)}`);
}

/** Removes a node and, with it, every link that touches it. Its neighbours stay. */
export function deleteNode(source: string, parsed: ParseResult, id: string): string {
  return rewriteStatements(source, parsed, (st) => {
    if (!st.groups.some((g) => g.some((r) => r.name === id))) return null;
    const pieces: Piece[] = [];
    let current: Piece = { groups: [], arrows: [] };
    st.groups.forEach((group, k) => {
      const kept = group.filter((r) => r.name !== id);
      if (kept.length === 0) {
        // The chain breaks where the node was.
        if (current.groups.length) pieces.push(current);
        current = { groups: [], arrows: [] };
        return;
      }
      if (current.groups.length) current.arrows.push(st.arrows[k - 1]);
      current.groups.push(kept);
    });
    if (current.groups.length) pieces.push(current);
    return { pieces, extra: [] };
  });
}

/** Removes one link. Both of its nodes stay, as do their other links. */
export function deleteLink(source: string, parsed: ParseResult, from: string, to: string): string {
  return rewriteStatements(source, parsed, (st) => {
    const cuts = new Set<number>();
    const extra: string[] = [];
    st.arrows.forEach((arrow, k) => {
      const made = st.groups[k].flatMap((a) => st.groups[k + 1].flatMap((b) => arrowLinks(arrow, a.name, b.name)));
      if (!made.some(([s, t]) => s === from && t === to)) return;
      cuts.add(k);
      // Restate the arrow's other links one by one, since it can no longer be shared.
      for (const [s, t] of made) {
        if (s === from && t === to) continue;
        extra.push(`${formatName(s)} ${formatArrow(false, arrow.left || arrow.right, arrow.weight)} ${formatName(t)}`);
      }
    });
    if (cuts.size === 0) return null;
    const pieces: Piece[] = [];
    let current: Piece = { groups: [st.groups[0]], arrows: [] };
    st.arrows.forEach((arrow, k) => {
      if (cuts.has(k)) {
        pieces.push(current);
        current = { groups: [st.groups[k + 1]], arrows: [] };
      } else {
        current.arrows.push(arrow);
        current.groups.push(st.groups[k + 1]);
      }
    });
    pieces.push(current);
    return { pieces, extra };
  });
}

interface Piece {
  groups: NodeRef[][];
  arrows: Arrow[];
}

/**
 * Replaces each statement `change` returns pieces for. A piece that is just a
 * list of nodes is dropped when every one of them is still mentioned on some
 * other line, so deleting things does not leave stray lone-node lines.
 */
function rewriteStatements(
  source: string,
  parsed: ParseResult,
  change: (st: Statement) => { pieces: Piece[]; extra: string[] } | null,
): string {
  const lines: (string | null)[] = source.split("\n");
  const changes = parsed.statements.flatMap((st) => {
    const result = change(st);
    return result ? [{ st, ...result }] : [];
  });
  // Only lines this edit leaves alone count as "still mentioned".
  const changed = new Set(changes.map((c) => c.st.line));
  const mentionedElsewhere = (name: string) => (parsed.names.get(name) ?? []).some((s) => !changed.has(s.line));

  for (const { st, pieces, extra } of changes) {
    const kept = pieces.filter((p) => p.groups.length > 1 || p.groups[0].some((r) => !mentionedElsewhere(r.name)));
    const text = [...kept.map(serialize), ...extra].map((l) => st.indent + l);
    lines[st.line] = text.length ? text.join("\n") : null;
  }
  return lines.filter((l) => l !== null).join("\n");
}

function serialize(piece: Piece): string {
  return piece.groups
    .map((g) => g.map((r) => r.raw).join(", "))
    .reduce((out, group, k) => `${out} ${piece.arrows[k - 1].text} ${group}`);
}

function replaceSpans(source: string, edits: { span: Span; text: string }[]): string {
  const lines = source.split("\n");
  // Right to left, so earlier offsets on the same line stay valid.
  const ordered = [...edits].sort((a, b) => b.span.line - a.span.line || b.span.start - a.span.start);
  for (const { span, text } of ordered) {
    const line = lines[span.line];
    lines[span.line] = line.slice(0, span.start) + text + line.slice(span.end);
  }
  return lines.join("\n");
}
