import { nodeRadius, type SceneLink, type SceneNode } from "./scene";
import type { RendererOptions } from "./types";

export interface ExportOptions {
  /** World units of empty space around the graph. */
  padding?: number;
  /** Pixels per world unit. PNG only. */
  scale?: number;
  transparent?: boolean;
  labels?: boolean;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function buildSvg(
  nodes: readonly SceneNode[],
  links: readonly SceneLink[],
  options: RendererOptions,
  box: Box,
  { padding = 48, transparent = false, labels = true }: ExportOptions = {},
): string {
  const { theme } = options;
  const x0 = box.left - padding;
  const y0 = box.top - padding;
  const width = box.right - box.left + padding * 2;
  const height = box.bottom - box.top + padding * 2;
  const radius = new Map(nodes.map((n) => [n, nodeRadius({ ...n, appear: 1 }, options)]));
  const fontSize = 12 * options.textSize;
  const arrowLength = Math.max(6, options.linkThickness * 4) * Math.min(1.5, options.linkThickness * 0.5 + 0.5);
  const f = (v: number) => +v.toFixed(2);

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(width)} ${f(height)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}">`,
  ];
  if (theme.background && !transparent) {
    out.push(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(width)}" height="${f(height)}" ${paint("fill", theme.background)}/>`);
  }

  out.push(`<g ${paint("stroke", theme.link)} stroke-width="${options.linkThickness}" stroke-linecap="round">`);
  for (const { source: s, target: t } of links) {
    if (s !== t) out.push(`<line x1="${f(s.x)}" y1="${f(s.y)}" x2="${f(t.x)}" y2="${f(t.y)}"/>`);
  }
  out.push("</g>");

  if (options.arrows) {
    out.push(`<g ${paint("fill", theme.link)}>`);
    for (const { source: s, target: t } of links) {
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const length = Math.hypot(dx, dy);
      const tr = radius.get(t)!;
      if (length < tr + arrowLength) continue;
      const ux = dx / length;
      const uy = dy / length;
      const tipX = t.x - ux * (tr + 1);
      const tipY = t.y - uy * (tr + 1);
      const bx = tipX - ux * arrowLength;
      const by = tipY - uy * arrowLength;
      const half = arrowLength * 0.45;
      out.push(
        `<path d="M${f(tipX)} ${f(tipY)}L${f(bx - uy * half)} ${f(by + ux * half)}L${f(bx + uy * half)} ${f(by - ux * half)}Z"/>`,
      );
    }
    out.push("</g>");
  }

  const weighted = links.filter((l) => l.label);
  if (labels && weighted.length > 0) {
    const size = 10 * options.textSize;
    out.push(`<g font-family="${escape(theme.fontFamily)}" font-size="${f(size)}" text-anchor="middle" dominant-baseline="central">`);
    for (const { source: s, target: t, label } of weighted) {
      const x = (s.x + t.x) / 2;
      const y = (s.y + t.y) / 2;
      const w = label.length * size * 0.6 + size * 0.6;
      if (theme.background && !transparent) {
        out.push(`<rect x="${f(x - w / 2)}" y="${f(y - size * 0.7)}" width="${f(w)}" height="${f(size * 1.4)}" ${paint("fill", theme.background)}/>`);
      }
      out.push(`<text x="${f(x)}" y="${f(y)}" ${paint("fill", theme.text)}>${escape(label)}</text>`);
    }
    out.push("</g>");
  }

  out.push(`<g ${paint("fill", theme.node)}>`);
  for (const n of nodes) {
    const fill = n.color ? ` ${paint("fill", n.color)}` : "";
    out.push(`<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(radius.get(n)!)}"${fill}/>`);
  }
  out.push("</g>");

  if (labels) {
    out.push(
      `<g ${paint("fill", theme.text)} font-family="${escape(theme.fontFamily)}" font-size="${f(fontSize)}" text-anchor="middle" dominant-baseline="hanging">`,
    );
    for (const n of nodes) {
      if (!n.label) continue;
      const y = n.y + radius.get(n)! + fontSize * 0.35;
      out.push(`<text x="${f(n.x)}" y="${f(y)}">${escape(n.label)}</text>`);
    }
    out.push("</g>");
  }

  out.push("</svg>");
  return out.join("\n");
}

/** `fill="red"`, or `style="fill:var(--ink)"` for a CSS variable, which an attribute can't hold. */
function paint(property: "fill" | "stroke", color: string): string {
  return /^\s*var\(/.test(color) ? `style="${property}:${escape(color)}"` : `${property}="${escape(color)}"`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
