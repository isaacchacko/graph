import { formatArrow, formatName, linkKey, type ParseResult, type Span } from "./parse";

/** Source edits made from the canvas. Each returns the new source text. */

export function appendLine(source: string, line: string): string {
  const body = source.trimEnd();
  return body ? `${body}\n${line}\n` : `${line}\n`;
}

export function renameNode(source: string, parsed: ParseResult, oldId: string, newId: string): string {
  const spans = parsed.names.get(oldId) ?? [];
  return replaceSpans(source, spans.map((span) => ({ span, text: formatName(newId) })));
}

/** Sets (or with an empty `weight`, clears) the weight on one link. */
export function setLinkWeight(source: string, parsed: ParseResult, from: string, to: string, weight: string): string {
  const arrow = parsed.arrows.get(linkKey(from, to));
  if (arrow) return replaceSpans(source, [{ span: arrow, text: formatArrow(arrow.left, arrow.right, weight) }]);
  // The link shares its arrow with other links (a fan-out): restate just this one.
  return appendLine(source, `${formatName(from)} ${formatArrow(false, true, weight)} ${formatName(to)}`);
}

export function uniqueName(taken: Iterable<string>, base = "Untitled"): string {
  const names = new Set(taken);
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
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
