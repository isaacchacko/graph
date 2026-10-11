# graph

Pretty force-directed graphs, quickly. Type a few links, watch them settle, export or share.

```
graph -> renderer, website
renderer -> physics, camera, labels
Sun {gold 3} -> Earth -> Moon
```

## Layout

| Path | What it is |
| --- | --- |
| `packages/renderer` | `@graph/renderer`: a dependency-free, framework-agnostic graph renderer (canvas + force simulation) |
| `apps/web` | Next.js + shadcn/ui site: one left drawer holding the source editor, Obsidian-style graph settings, themes, PNG/SVG export and share links |

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # renderer physics + parser
pnpm typecheck
```

## The renderer

```ts
import { GraphRenderer } from "@graph/renderer";

const graph = new GraphRenderer(container, { arrows: true });
graph.setData({
  nodes: [{ id: "a" }, { id: "b", color: "tomato", size: 2 }],
  links: [{ source: "a", target: "b" }],
});
graph.on("nodeClick", ({ id }) => console.log(id));
```

- **Physics**: a cooling ("alpha") force simulation with Barnes–Hut repulsion, degree-weighted link springs and a centre pull, tuned through the same four knobs Obsidian exposes (center, repel, link force, link distance). It goes idle once settled, so nothing renders while the graph is still.
- **Stable updates**: `setData` keeps the positions of surviving nodes and seeds new ones next to a linked neighbour, so editing never reshuffles the graph. A brand-new graph starts packed tight and unfolds, which untangles far better than a wide random start.
- **Interaction**: hover a node to dim everything outside its neighbourhood, with the hovered node and its links in the accent colour. Drag from a node to draw a link (red and half-transparent until it is over another node, which emits `connect`). Double-click a node and keep holding to drag it. Clicking a link emits `linkClick` and clicking empty canvas emits `backgroundClick`. Pan, and wheel or pinch to zoom about the cursor.
- **Labels** fade in with zoom past a threshold, and labels in the focused neighbourhood are always shown.
- **Display**: node size grows with degree. Arrows, node size, link thickness and text size are all adjustable, and colours come from a `Theme`.
- **Extras**: `replay()` rebuilds the graph node by node (Obsidian's "Animate"). `toPNG()` and `toSVG()` export the graph cropped to its bounds. `setInsets()` keeps framing clear of overlaid UI.

## The language

| Syntax | Meaning |
| --- | --- |
| `A -> B` | link (`<-` reverses, `--` undirected, `<->` both ways) |
| `A -(3)-> B` | weighted link, shown at its midpoint (works on every arrow: `-(3)-`, `<-(3)-`, …) |
| `A -> B, C` | fan out |
| `A -> B -> C` | chain |
| `A {red 2}` | colour and size, wherever the node appears |
| `"Acme, Inc."` | quote names containing `,` `{` `}` or arrows |
| `# …` / `// …` | comments |

## Editing on the canvas

The text is the source of truth, and canvas edits rewrite it in place:

- **Click empty canvas**: a node appears immediately with its name field focused. Type, then press Enter or click away. Escape un-makes it.
- **Drag from a node to another**: appends `A -> B`.
- **Click a link**: edit its weight. Its arrow is rewritten in place (`A -> B` becomes `A -(5)-> B`). If the arrow is shared by a fan-out, the link is restated on its own line.

## Clean-room note

This is an independent implementation of the *behaviour* of Obsidian's graph view: how it looks and responds, as observable by any user of the app. No Obsidian source code, bundles or assets were read, decompiled or copied. The physics follow the standard published force-directed techniques (spring embedders, Barnes–Hut approximation), and every line here was written from scratch. "Obsidian" is a trademark of Dynalist Inc. This project is not affiliated with or endorsed by them.
