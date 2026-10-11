import { mixColors } from "./color";
import type { SimLink, SimNode } from "./simulation";
import type { Point, RendererOptions } from "./types";

export interface SceneNode extends SimNode {
  id: string;
  label: string;
  color: string | null;
  sizeMul: number;
  /** Opacity, animated toward 1 or `dimOpacity`. */
  fade: number;
  /** 0–1 blend toward the accent color. */
  accent: number;
  /** 0–1, how strongly the label is forced visible regardless of zoom. */
  emphasis: number;
  /** 0–1 grow-in animation for newly added nodes. */
  appear: number;
}

export interface SceneLink extends SimLink<SceneNode> {
  label: string;
  fade: number;
  accent: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface View {
  camera: Camera;
  /** CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
}

export interface DrawExtras {
  /** Forces every label to this opacity (used for exports). */
  labelOpacity?: number;
  /** In-progress drag-to-connect; `valid` once the pointer is over another node. */
  connectPreview?: { from: SceneNode; to: Point; valid: boolean } | null;
}

const BASE_RADIUS = 4;
const BASE_FONT = 12;
const MIN_FOCUSED_FONT_PX = 11;
const ALPHA_STEPS = 20;
const ACCENT_STEPS = 8;

export function nodeRadius(node: SceneNode, options: RendererOptions): number {
  const grow = 1 - Math.pow(1 - node.appear, 3);
  return options.nodeSize * node.sizeMul * BASE_RADIUS * (1 + 0.35 * Math.sqrt(node.degree)) * grow;
}

/** Opacity labels get from zoom alone, before hover emphasis. */
export function zoomLabelOpacity(scale: number, threshold: number): number {
  return clamp01(Math.log2(scale) - threshold + 1);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  nodes: readonly SceneNode[],
  links: readonly SceneLink[],
  options: RendererOptions,
  view: View,
  extras: DrawExtras = {},
): void {
  const { camera, width, height, pixelRatio } = view;
  const { theme } = options;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (theme.background) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  const s = camera.scale * pixelRatio;
  ctx.setTransform(s, 0, 0, s, pixelRatio * (width / 2 - camera.x * camera.scale), pixelRatio * (height / 2 - camera.y * camera.scale));

  const halfW = width / 2 / camera.scale;
  const halfH = height / 2 / camera.scale;
  const bounds = {
    left: camera.x - halfW,
    right: camera.x + halfW,
    top: camera.y - halfH,
    bottom: camera.y + halfH,
  };

  const radii = new Float32Array(nodes.length);
  const indexOf = new Map<SceneNode, number>();
  nodes.forEach((n, i) => {
    radii[i] = nodeRadius(n, options);
    indexOf.set(n, i);
  });

  drawLinks(ctx, links, radii, indexOf, options, camera.scale, bounds);
  if (extras.connectPreview) drawConnectPreview(ctx, extras.connectPreview, options, camera.scale);
  drawLinkLabels(ctx, links, options, camera.scale, bounds, extras.labelOpacity);
  drawNodes(ctx, nodes, radii, options, bounds);
  drawLabels(ctx, nodes, radii, options, camera.scale, bounds, extras.labelOpacity);
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function drawLinks(
  ctx: CanvasRenderingContext2D,
  links: readonly SceneLink[],
  radii: Float32Array,
  indexOf: Map<SceneNode, number>,
  options: RendererOptions,
  scale: number,
  b: Bounds,
): void {
  const { theme } = options;
  const lineWidth = Math.max(options.linkThickness, 0.6 / scale);
  const arrowLength = Math.max(6, lineWidth * 4) * Math.min(1.5, options.linkThickness * 0.5 + 0.5);

  // Batch strokes by (opacity, accent) so a thousand links cost a handful of draw calls.
  const buckets = new Map<number, SceneLink[]>();
  for (const link of links) {
    const { source: s, target: t } = link;
    if (s === t) continue;
    if (
      (s.x < b.left && t.x < b.left) ||
      (s.x > b.right && t.x > b.right) ||
      (s.y < b.top && t.y < b.top) ||
      (s.y > b.bottom && t.y > b.bottom)
    ) {
      continue;
    }
    const appear = Math.min(s.appear, t.appear);
    const alpha = Math.round(link.fade * appear * ALPHA_STEPS);
    if (alpha === 0) continue;
    const key = alpha * (ACCENT_STEPS + 1) + Math.round(link.accent * ACCENT_STEPS);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push(link);
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  for (const [key, bucket] of buckets) {
    const accent = (key % (ACCENT_STEPS + 1)) / ACCENT_STEPS;
    const alpha = Math.floor(key / (ACCENT_STEPS + 1)) / ALPHA_STEPS;
    const color = mixColors(theme.link, theme.accent, accent);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const { source: s, target: t } of bucket) {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();

    if (!options.arrows) continue;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const { source: s, target: t } of bucket) {
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const length = Math.hypot(dx, dy);
      const tr = radii[indexOf.get(t)!];
      if (length < tr + arrowLength) continue;
      const ux = dx / length;
      const uy = dy / length;
      const tipX = t.x - ux * (tr + 1);
      const tipY = t.y - uy * (tr + 1);
      const baseX = tipX - ux * arrowLength;
      const baseY = tipY - uy * arrowLength;
      const half = arrowLength * 0.45;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX - uy * half, baseY + ux * half);
      ctx.lineTo(baseX + uy * half, baseY - ux * half);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const INVALID_CONNECT_COLOR = "#ef4444";

function drawConnectPreview(
  ctx: CanvasRenderingContext2D,
  preview: { from: SceneNode; to: Point; valid: boolean },
  options: RendererOptions,
  scale: number,
): void {
  ctx.save();
  ctx.globalAlpha = preview.valid ? 1 : 0.5;
  ctx.strokeStyle = preview.valid ? options.theme.accent : INVALID_CONNECT_COLOR;
  ctx.lineWidth = Math.max(options.linkThickness * 1.5, 1.5 / scale);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(preview.from.x, preview.from.y);
  ctx.lineTo(preview.to.x, preview.to.y);
  ctx.stroke();
  ctx.restore();
}

export const LINK_LABEL_FONT = 10;

function drawLinkLabels(
  ctx: CanvasRenderingContext2D,
  links: readonly SceneLink[],
  options: RendererOptions,
  scale: number,
  b: Bounds,
  forcedOpacity: number | undefined,
): void {
  const { theme } = options;
  // Weights stay readable a little further out than node labels.
  const zoomOpacity = forcedOpacity ?? zoomLabelOpacity(scale, options.textFadeThreshold - 1);
  const fontSize = LINK_LABEL_FONT * options.textSize;
  ctx.font = `${fontSize}px ${theme.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const link of links) {
    if (!link.label) continue;
    const opacity = Math.max(zoomOpacity, link.accent) * link.fade * Math.min(link.source.appear, link.target.appear);
    if (opacity < 0.02) continue;
    const x = (link.source.x + link.target.x) / 2;
    const y = (link.source.y + link.target.y) / 2;
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
    const w = ctx.measureText(link.label).width + fontSize * 0.6;
    const h = fontSize * 1.4;
    ctx.globalAlpha = opacity;
    if (theme.background) {
      ctx.fillStyle = theme.background;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    }
    ctx.fillStyle = mixColors(theme.text, theme.accent, link.accent);
    ctx.fillText(link.label, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: readonly SceneNode[],
  radii: Float32Array,
  options: RendererOptions,
  b: Bounds,
): void {
  const { theme } = options;
  const buckets = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const r = radii[i];
    if (r <= 0 || n.x + r < b.left || n.x - r > b.right || n.y + r < b.top || n.y - r > b.bottom) return;
    const alpha = Math.round(n.fade * ALPHA_STEPS);
    if (alpha === 0) return;
    const color = mixColors(n.color ?? theme.node, theme.accent, Math.round(n.accent * ACCENT_STEPS) / ACCENT_STEPS);
    const key = `${alpha}|${color}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push(i);
  });

  for (const [key, bucket] of buckets) {
    const bar = key.indexOf("|");
    ctx.globalAlpha = Number(key.slice(0, bar)) / ALPHA_STEPS;
    ctx.fillStyle = key.slice(bar + 1);
    ctx.beginPath();
    for (const i of bucket) {
      const n = nodes[i];
      ctx.moveTo(n.x + radii[i], n.y);
      ctx.arc(n.x, n.y, radii[i], 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  nodes: readonly SceneNode[],
  radii: Float32Array,
  options: RendererOptions,
  scale: number,
  b: Bounds,
  forcedOpacity: number | undefined,
): void {
  const { theme } = options;
  const zoomOpacity = forcedOpacity ?? zoomLabelOpacity(scale, options.textFadeThreshold);
  const baseFont = BASE_FONT * options.textSize;
  const focusedFont = Math.max(baseFont, MIN_FOCUSED_FONT_PX / scale);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = theme.text;
  let currentFont = "";
  nodes.forEach((n, i) => {
    if (!n.label) return;
    const opacity = Math.max(zoomOpacity, n.emphasis) * n.fade * n.appear;
    if (opacity < 0.02) return;
    const fontSize = baseFont + (focusedFont - baseFont) * n.emphasis;
    const y = n.y + radii[i] + fontSize * 0.35;
    if (n.x < b.left - 400 || n.x > b.right + 400 || y > b.bottom || y + fontSize < b.top) return;
    const font = `${fontSize.toFixed(2)}px ${theme.fontFamily}`;
    if (font !== currentFont) ctx.font = currentFont = font;
    ctx.globalAlpha = opacity;
    ctx.fillText(n.label, n.x, y);
  });
  ctx.globalAlpha = 1;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
