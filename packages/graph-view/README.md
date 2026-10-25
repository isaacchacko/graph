# @isaacchacko/graph

Pretty, living force-directed graphs from a few lines of text. Write `A -> B, C` and you get a graph that settles into place, responds to hover, drag, pan and zoom, and exports to PNG or SVG.

It is the renderer behind [graph.isaacchacko.com](https://graph.isaacchacko.com), packaged for your own pages. There are no runtime dependencies, and React is optional.

## Pick how you want to use it

### 1. No build step: one `<script>` and one tag

```html
<script src="https://unpkg.com/@isaacchacko/graph"></script>

<graph-view arrows>
  graph -> renderer, website
  renderer -> physics, camera, labels
  Sun {gold 3} -> Earth -> Moon
</graph-view>
```

The text inside the tag is the graph. Change it (or set `.source`) and the graph updates without reshuffling.

| Attribute | Values |
| --- | --- |
| `theme` | `auto` (default, follows the OS), `dark`, `light` |
| `arrows` | present to draw arrowheads |
| `mode` | `select` (default: drag nodes, pan) or `edit` (drag node→node to emit `connect`) |
| `no-zoom` | present to let the wheel scroll the page instead of zooming the graph |

Size it with CSS. It is `display: block; height: 400px` until you say otherwise.

```js
const el = document.querySelector("graph-view");
el.source = "x -> y -> z";                      // or el.data = { nodes, links }
el.options = { nodeSize: 1.5, forces: { repelForce: 14 } };
el.addEventListener("nodeClick", (e) => console.log(e.detail.id));
await el.renderer.toPNG();                      // the full renderer API
```

The same script also exposes everything below as `window.GraphView`.

### 2. React

```sh
npm i @isaacchacko/graph
```

```tsx
import { Graph } from "@isaacchacko/graph/react";

<Graph source={"A -> B, C\nB -> C"} theme="light" onNodeClick={({ id }) => alert(id)} />;
```

| Prop | |
| --- | --- |
| `source` | the graph language as a string |
| `data` | `{ nodes, links }` instead of `source` |
| `theme` | `"dark"`, `"light"` or a partial `Theme` |
| `options` | any renderer option (see below) |
| `highlighted` | node ids to emphasise, e.g. search matches |
| `selection` | a node, nodes or link to draw as selected |
| `onReady` | receives the `GraphRenderer` for exports, zoom, replay… |
| `onNodeClick`, `onConnect`, … | every renderer event, as `on` + its name |
| `className` / `style` | without either it fills the width and is 400px tall |

It works in Next.js server-component trees as is (it ships `"use client"`).

### 3. Web component in a bundler (Vue, Svelte, Astro, plain TS…)

```ts
import "@isaacchacko/graph/element"; // registers <graph-view>
```

### 4. Plain TypeScript

```ts
import { GraphRenderer, parseGraph, LIGHT_THEME } from "@isaacchacko/graph";

const graph = new GraphRenderer(document.getElementById("graph")!, { theme: LIGHT_THEME, arrows: true });
graph.setData(parseGraph("A -> B -> C").data);
// or graph.setData({ nodes: [{ id: "a" }, { id: "b", color: "tomato", size: 2 }], links: [{ source: "a", target: "b" }] });

graph.on("nodeClick", ({ id }) => console.log(id));
const svg = graph.toSVG();
const png = await graph.toPNG({ transparent: true });
graph.destroy();
```

The container must have a size; the canvas fills it and follows it as it resizes.

### 5. Just an iframe

Make a graph at [graph.isaacchacko.com](https://graph.isaacchacko.com), open *Export & share*, and press *Copy embed code*. You can also write the URL by hand:

```html
<iframe src="https://graph.isaacchacko.com/embed?source=A%20-%3E%20B%2C%20C&theme=paper&arrows"
        width="100%" height="400" style="border:0"></iframe>
```

## The language

| Syntax | Meaning |
| --- | --- |
| `A -> B` | link (`<-` reverses, `--` undirected, `<->` both ways) |
| `A -(3)-> B` | weighted link, shown at its midpoint (works on every arrow) |
| `A -> B, C` | fan out |
| `A -> B -> C` | chain |
| `A {red 2}` | colour and size, wherever the node appears |
| `"Acme, Inc."` | quote names containing `,` `{` `}` or arrows |
| `# …` / `// …` | comments |

`parseGraph(text)` returns `{ data, errors }` (plus source spans, for editors), with `errors` as `{ line, message }[]`. A bad line is skipped and the rest of the graph still renders.

## Renderer API

| Method | |
| --- | --- |
| `new GraphRenderer(container, options?)` | creates the canvas inside `container` |
| `setData({ nodes, links })` | keeps positions of nodes that survive, seeds new ones next to a neighbour |
| `setOptions(partial)` | any option below; forces and theme merge |
| `on(event, fn)` | returns an unsubscribe function |
| `zoomToFit()`, `zoomBy(factor)` | camera |
| `replay(ms?)` | rebuilds the graph node by node |
| `reheat(alpha?)` | shakes the layout loose |
| `setHighlighted(ids \| null)`, `setSelection(sel)` | emphasis |
| `toPNG(opts?)`, `toSVG(opts?)` | exports cropped to the graph |
| `setInsets({ top, right, bottom, left })` | keeps framing clear of overlaid UI |
| `destroy()` | removes the canvas and listeners |

**Options**: `theme` (`background`, `node`, `link`, `text`, `accent`, `fontFamily`), `forces` (`centerForce`, `repelForce`, `linkForce`, `linkDistance`), `nodeSize`, `linkThickness`, `textSize`, `arrows`, `mode`, `zoom`, `textFadeThreshold`, `dimOpacity`.

**Node fields**: `id`, `label`, `color`, `size`, `x`, `y`. **Link fields**: `source`, `target`, `label`, `length`.

**Events**: `nodeClick`, `nodeDoubleClick`, `nodeHover`, `linkClick`, `backgroundClick`, `backgroundDoubleClick`, `connect`, `boxSelect`, `nodeContextMenu`, `linkContextMenu`, `zoom`.

## License

MIT
