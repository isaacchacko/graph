import type { ForceSettings, RendererOptions, Theme } from "./types";

export const DEFAULT_FORCES: ForceSettings = {
  centerForce: 0.5,
  repelForce: 10,
  linkForce: 1,
  linkDistance: 100,
};

export const DARK_THEME: Theme = {
  background: "#1e1e1e",
  node: "#a8a8a8",
  link: "#4a4a4a",
  text: "#dcddde",
  accent: "#8f7cf7",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const LIGHT_THEME: Theme = {
  background: "#ffffff",
  node: "#8a8a8a",
  link: "#d6d6d6",
  text: "#2e2e2e",
  accent: "#6d55e8",
  fontFamily: DARK_THEME.fontFamily,
};

export const DEFAULT_OPTIONS: RendererOptions = {
  forces: DEFAULT_FORCES,
  theme: DARK_THEME,
  nodeSize: 1,
  linkThickness: 1,
  textSize: 1,
  arrows: false,
  mode: "edit",
  textFadeThreshold: 0,
  dimOpacity: 0.15,
};
