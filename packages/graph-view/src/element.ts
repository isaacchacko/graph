import { RENDERER_EVENTS, resolveTheme } from "./defaults";
import { parseGraph } from "./parse";
import { GraphRenderer, type PartialOptions } from "./renderer";
import type { GraphData, InteractionMode } from "./types";

// Importing this module on a server (SSR) must not throw.
const Base = typeof HTMLElement === "undefined" ? (class {} as typeof HTMLElement) : HTMLElement;

/**
 * `<graph-view>`: the graph language as the element's text, drawn as a live graph.
 *
 * ```html
 * <graph-view theme="light" arrows>
 *   A -> B, C
 *   B -> C
 * </graph-view>
 * ```
 *
 * Attributes: `theme` (`dark`, `light`, or `auto` to follow the OS, the default),
 * `arrows`, `mode` (`select` or `edit`), `no-zoom` (the wheel scrolls the page instead). Properties: `source`, `data` and
 * `options` override the text and attributes, and `renderer` is the underlying
 * {@link GraphRenderer}. Renderer events are re-dispatched as `CustomEvent`s of
 * the same name (`nodeClick`, `connect`, …) carrying the payload in `detail`.
 */
export class GraphViewElement extends Base {
  static observedAttributes = ["theme", "arrows", "mode", "no-zoom"];

  renderer: GraphRenderer | null = null;
  private _source: string | null = null;
  private _data: GraphData | null = null;
  private _options: PartialOptions = {};
  private textObserver: MutationObserver | null = null;
  private darkQuery: MediaQueryList | null = null;

  get source(): string {
    return this._source ?? this.textContent ?? "";
  }
  set source(value: string) {
    this._source = value;
    this.renderData();
  }

  get data(): GraphData {
    return this._data ?? parseGraph(this.source).data;
  }
  set data(value: GraphData | null) {
    this._data = value;
    this.renderData();
  }

  get options(): PartialOptions {
    return this._options;
  }
  set options(value: PartialOptions) {
    this._options = value;
    this.renderOptions();
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = "<style>:host{display:block;position:relative;height:400px}div{position:absolute;inset:0}</style><div></div>";
    this.renderer = new GraphRenderer(root.querySelector("div")!, this.resolvedOptions());
    for (const event of RENDERER_EVENTS) {
      this.renderer.on(event, (detail) => this.dispatchEvent(new CustomEvent(event, { detail })));
    }
    this.textObserver = new MutationObserver(() => this._source === null && this._data === null && this.renderData());
    this.textObserver.observe(this, { childList: true, characterData: true, subtree: true });
    this.darkQuery = matchMedia("(prefers-color-scheme: dark)");
    this.darkQuery.addEventListener("change", this.renderOptions);
    this.renderData();
  }

  disconnectedCallback(): void {
    this.textObserver?.disconnect();
    this.darkQuery?.removeEventListener("change", this.renderOptions);
    this.renderer?.destroy();
    this.renderer = null;
  }

  attributeChangedCallback(): void {
    this.renderOptions();
  }

  private renderData(): void {
    this.renderer?.setData(this.data);
  }

  private renderOptions = (): void => {
    this.renderer?.setOptions(this.resolvedOptions());
  };

  private resolvedOptions(): PartialOptions {
    const attr = this.getAttribute("theme");
    const theme = attr === "dark" || attr === "light" ? attr : this.darkQuery?.matches === false ? "light" : "dark";
    const mode = this.getAttribute("mode");
    return {
      theme: resolveTheme(theme),
      arrows: this.hasAttribute("arrows"),
      zoom: !this.hasAttribute("no-zoom"),
      ...(mode === "select" || mode === "edit" ? { mode: mode as InteractionMode } : {}),
      ...this._options,
    };
  }
}

if (typeof customElements !== "undefined" && !customElements.get("graph-view")) {
  customElements.define("graph-view", GraphViewElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "graph-view": GraphViewElement;
  }
}
