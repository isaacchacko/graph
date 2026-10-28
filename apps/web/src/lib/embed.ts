import { themeById, type AppTheme } from "./themes";

/** `?theme=` on an embed: a theme id, or `auto` to follow the embedding page's light/dark. */
export const AUTO_THEME = "auto";

const FALLBACK = { light: "paper", dark: "vault" };

/** The editor, opened on this graph. */
export function shareUrl(origin: string, hash: string): string {
  return `${origin}/#${hash}`;
}

/** The canvas alone, for an iframe. */
export function embedUrl(origin: string, hash: string, theme?: string): string {
  return `${origin}/embed${theme ? `?theme=${encodeURIComponent(theme)}` : ""}#${hash}`;
}

export function embedCode(src: string): string {
  return `<iframe src="${src}" width="100%" height="480" style="border:0" loading="lazy" title="graph"></iframe>`;
}

/**
 * The theme an embed draws in. `auto` keeps the graph's own theme when it suits the
 * page's scheme, and otherwise swaps in Paper (light) or Vault (dark).
 */
export function embedTheme(themeId: string, param: string | null, prefersDark: boolean): AppTheme {
  if (param !== AUTO_THEME) return themeById(param || themeId);
  const own = themeById(themeId);
  return !own.light === prefersDark ? own : themeById(prefersDark ? FALLBACK.dark : FALLBACK.light);
}
