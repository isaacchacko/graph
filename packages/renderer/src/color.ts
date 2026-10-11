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
