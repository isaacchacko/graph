export type RGB = [number, number, number];

const cache = new Map<string, RGB>();
let probe: CanvasRenderingContext2D | null | undefined;

/** Parses any CSS color the browser understands. Unknown colors become grey. */
export function parseColor(color: string): RGB {
  const cached = cache.get(color);
  if (cached) return cached;
  const rgb = parseHex(color) ?? parseRgbFunction(color) ?? parseWithCanvas(color) ?? [128, 128, 128];
  cache.set(color, rgb);
  return rgb;
}

export function mixColors(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [r1, g1, b1] = parseColor(a);
  const [r2, g2, b2] = parseColor(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(color: string): RGB | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((c) => c + c).join("");
  if (hex.length !== 6 && hex.length !== 8) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

function parseRgbFunction(color: string): RGB | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function parseWithCanvas(color: string): RGB | null {
  if (probe === undefined) {
    probe = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  if (!probe) return null;
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  const normalized = String(probe.fillStyle);
  return parseHex(normalized) ?? parseRgbFunction(normalized);
}

/** Perceived brightness of a color, 0 (black) to 1 (white). */
export function brightness([r, g, b]: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const imageBrightnesses = new WeakMap<HTMLImageElement, number | null>();

/** Mean brightness of an image's visible pixels, or null when it is cross-origin and its pixels can't be read. */
export function imageBrightness(img: HTMLImageElement): number | null {
  if (imageBrightnesses.has(img)) return imageBrightnesses.get(img)!;
  let result: number | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 16, 16);
    const { data } = ctx.getImageData(0, 0, 16, 16);
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      sum += brightness([data[i], data[i + 1], data[i + 2]]) * alpha;
      weight += alpha;
    }
    if (weight > 0) result = sum / weight;
  } catch {
    // A tainted canvas: the icon stays on the background plate.
  }
  imageBrightnesses.set(img, result);
  return result;
}

/** The plate behind an icon: the background, or a light one when a dark icon would vanish into a dark background. */
export function iconPlate(icon: HTMLImageElement, background: string): string {
  if (brightness(parseColor(background)) >= 0.5) return background;
  return (imageBrightness(icon) ?? 1) < 0.3 ? "#ffffff" : background;
}
