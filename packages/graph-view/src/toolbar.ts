import type { GraphRenderer } from "./renderer";
import type { InteractionMode } from "./types";

export interface ModeToolbarOptions {
  /** Called after the mode changes, from a click, a key or {@link ModeToolbar.setMode}. */
  onChange?: (mode: InteractionMode) => void;
  /** Bind S and E on the window. Off when the host routes keys itself. Default true. */
  keys?: boolean;
  /** Tooltip text per mode, for hosts where a mode does less than the defaults say. */
  tips?: Partial<Record<InteractionMode, string>>;
}

export interface ModeToolbar {
  /** The toolbar; place it wherever it should sit, usually absolutely over the graph. */
  element: HTMLElement;
  readonly mode: InteractionMode;
  setMode(mode: InteractionMode): void;
  destroy(): void;
}

// Icons are lucide's mouse-pointer-2 and pencil (ISC), the ones graph.isaacchacko.com uses.
const ICONS: Record<InteractionMode, string> = {
  select: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
};

const BUTTONS: { mode: InteractionMode; label: string; tip: string; key: string }[] = [
  { mode: "select", label: "Select mode", tip: "Select: drag nodes, pan", key: "S" },
  { mode: "edit", label: "Edit mode", tip: "Edit: add, link, rename, delete", key: "E" },
];

const CSS = `
.gv-modes{display:inline-flex;position:relative;font:12px/1 ui-sans-serif,system-ui,sans-serif}
.gv-modes button{all:unset;box-sizing:border-box;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--gv-text);background:var(--gv-bg);border:1px solid var(--gv-line);margin-left:-1px}
.gv-modes button:first-child{margin-left:0;border-radius:8px 0 0 8px}
.gv-modes button:last-child{border-radius:0 8px 8px 0}
.gv-modes button:hover{background:color-mix(in srgb,var(--gv-text) 8%,var(--gv-bg))}
.gv-modes button[aria-pressed=true]{background:color-mix(in srgb,var(--gv-text) 14%,var(--gv-bg));color:var(--gv-accent);z-index:1}
.gv-modes button:focus-visible{outline:2px solid var(--gv-accent);outline-offset:1px;z-index:2}
.gv-modes svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.gv-modes .gv-tip{position:absolute;top:calc(100% + 6px);white-space:nowrap;display:flex;gap:6px;align-items:center;padding:5px 8px;border-radius:6px;background:var(--gv-text);color:var(--gv-bg);pointer-events:none;opacity:0;transition:opacity .15s;z-index:3}
.gv-modes .gv-tip.on{opacity:1}
.gv-modes kbd{font:inherit;font-size:11px;padding:1px 5px;border-radius:4px;background:color-mix(in srgb,var(--gv-bg) 22%,transparent)}
`;

let styled = false;

/** The select/edit toggle from graph.isaacchacko.com, without React: two icon buttons that switch the renderer's mode. */
export function createModeToolbar(renderer: GraphRenderer, options: ModeToolbarOptions = {}): ModeToolbar {
  if (!styled) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    styled = true;
  }
  const { theme } = renderer.options;
  const element = document.createElement("div");
  element.className = "gv-modes";
  element.setAttribute("role", "group");
  element.style.cssText = `--gv-bg:${theme.background};--gv-text:${theme.text};--gv-line:${theme.link};--gv-accent:${theme.accent}`;

  const tip = document.createElement("span");
  tip.className = "gv-tip";
  const buttons = BUTTONS.map(({ mode, label, tip: text, key }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[mode]}</svg>`;
    button.onclick = () => toolbar.setMode(mode);
    button.onpointerenter = () => {
      tip.replaceChildren(options.tips?.[mode] ?? text, Object.assign(document.createElement("kbd"), { textContent: key }));
      tip.style.left = `${button.offsetLeft}px`;
      tip.classList.add("on");
    };
    button.onpointerleave = () => tip.classList.remove("on");
    element.appendChild(button);
    return { mode, button };
  });
  element.appendChild(tip);

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable=true]")) return;
    const mode = e.key === "s" ? "select" : e.key === "e" ? "edit" : null;
    if (mode) toolbar.setMode(mode);
  };
  if (options.keys !== false) addEventListener("keydown", onKey);

  const toolbar: ModeToolbar = {
    element,
    get mode() {
      return renderer.options.mode;
    },
    setMode(mode) {
      renderer.setOptions({ mode });
      for (const b of buttons) b.button.setAttribute("aria-pressed", String(b.mode === mode));
      options.onChange?.(mode);
    },
    destroy() {
      removeEventListener("keydown", onKey);
      element.remove();
    },
  };
  for (const b of buttons) b.button.setAttribute("aria-pressed", String(b.mode === renderer.options.mode));
  return toolbar;
}
