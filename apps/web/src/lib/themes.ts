import { DARK_THEME, type Theme } from "@graph/renderer";

export interface AppTheme {
  id: string;
  name: string;
  graph: Theme;
  /** Suggested colours for new groups. */
  palette: string[];
  /** Whether the chrome around the canvas should be light. */
  light?: boolean;
  /**
   * shadcn token overrides for the drawer and controls. Without them the
   * chrome takes the canvas background and the stock light or dark tokens.
   */
  chrome?: Record<`--${string}`, string>;
  /** Font for the chrome; defaults to the app's sans. */
  font?: string;
}

const font = DARK_THEME.fontFamily;
/** CSS variables are resolved to the real family before reaching the canvas. */
const mono = "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace";

export const THEMES: AppTheme[] = [
  {
    // From isaacchacko.co: a pale paper card over a green field, ink type, one terracotta accent.
    id: "hive",
    name: "Hive",
    light: true,
    graph: { background: "#a3c585", node: "#12200a", link: "#4a5e3a", text: "#12200a", accent: "#b9654c", fontFamily: mono },
    palette: ["#b9654c", "#12200a", "#eef3e6", "#d9a441", "#3d6b8c", "#7d3c52"],
    chrome: {
      "--background": "#eef3e6",
      "--foreground": "#12200a",
      "--card": "#eef3e6",
      "--card-foreground": "#12200a",
      "--popover": "#eef3e6",
      "--popover-foreground": "#12200a",
      "--muted": "#dfe9d2",
      "--muted-foreground": "#4a5e3a",
      "--accent": "#dfe9d2",
      "--accent-foreground": "#12200a",
      "--secondary": "#dfe9d2",
      "--secondary-foreground": "#12200a",
      "--border": "#c9d8b7",
      "--input": "#c9d8b7",
    },
    font: mono,
  },
  {
    id: "vault",
    name: "Vault",
    graph: DARK_THEME,
    palette: ["#e06c75", "#e5c07b", "#98c379", "#56b6c2", "#61afef", "#c678dd"],
  },
  {
    id: "paper",
    name: "Paper",
    light: true,
    graph: { background: "#faf8f5", node: "#7d7a75", link: "#dcd7cf", text: "#2b2926", accent: "#d9480f", fontFamily: font },
    palette: ["#d9480f", "#2b8a3e", "#1971c2", "#9c36b5", "#e67700", "#c2255c"],
  },
  {
    id: "midnight",
    name: "Midnight",
    graph: { background: "#0b1020", node: "#7f8bb3", link: "#26304f", text: "#c9d1f0", accent: "#7dd3fc", fontFamily: font },
    palette: ["#7dd3fc", "#f0abfc", "#fcd34d", "#86efac", "#fda4af", "#a5b4fc"],
  },
  {
    id: "rose",
    name: "Rosé",
    graph: { background: "#191724", node: "#908caa", link: "#2a273f", text: "#e0def4", accent: "#ebbcba", fontFamily: font },
    palette: ["#ebbcba", "#f6c177", "#9ccfd8", "#c4a7e7", "#31748f", "#eb6f92"],
  },
  {
    id: "forest",
    name: "Forest",
    graph: { background: "#141a14", node: "#8fa58a", link: "#2b362a", text: "#dfe8d8", accent: "#c3e88d", fontFamily: font },
    palette: ["#c3e88d", "#ffcb6b", "#f78c6c", "#89ddff", "#c792ea", "#82aaff"],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    graph: { background: "#0f3a6b", node: "#cfe3ff", link: "#3d6aa0", text: "#e8f1ff", accent: "#ffd166", fontFamily: font },
    palette: ["#ffd166", "#ef476f", "#06d6a0", "#ffffff", "#118ab2", "#f78c6b"],
  },
  {
    id: "ink",
    name: "Ink",
    light: true,
    graph: { background: "#ffffff", node: "#111111", link: "#c8c8c8", text: "#111111", accent: "#ff3b30", fontFamily: font },
    palette: ["#ff3b30", "#007aff", "#34c759", "#ff9500", "#af52de", "#5ac8fa"],
  },
];

export function themeById(id: string): AppTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
