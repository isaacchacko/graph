import { DEFAULT_OPTIONS } from "./defaults";
import { drawScene, nodeRadius, type Camera, type SceneLink, type SceneNode } from "./scene";
import { ForceSimulation } from "./simulation";
import { buildSvg, type ExportOptions } from "./export";
import type { GraphData, Point, RendererEvents, RendererOptions } from "./types";

type Listener<K extends keyof RendererEvents> = (payload: RendererEvents[K]) => void;
type ListenerMap = { [K in keyof RendererEvents]?: Set<Listener<K>> };

type Gesture =
  | { kind: "pan"; pointerId: number; startX: number; startY: number; camX: number; camY: number; moved: boolean }
  | { kind: "drag"; pointerId: number; node: SceneNode; startX: number; startY: number; moved: boolean }
  | { kind: "connect"; pointerId: number; node: SceneNode; to: Point }
  | { kind: "pinch"; distance: number; scale: number; center: Point };

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PartialOptions extends Partial<Omit<RendererOptions, "forces" | "theme">> {
  forces?: Partial<RendererOptions["forces"]>;
  theme?: Partial<RendererOptions["theme"]>;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 8;
const CLICK_SLOP = 4;
const FADE_TIME_MS = 90;
const APPEAR_TIME_MS = 260;
const CAMERA_TIME_MS = 140;
const FIT_PADDING = 48;
const EPSILON = 0.002;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * An interactive force-directed graph drawn on a 2D canvas.
 *
 * Owns the canvas, the physics, the camera and the pointer interactions. Feed
 * it data with {@link setData}; it keeps positions of nodes that survive an
 * update so editing a graph never reshuffles it.
 */
export class GraphRenderer {
  readonly canvas: HTMLCanvasElement;
  options: RendererOptions;

  private ctx: CanvasRenderingContext2D;
  private sim: ForceSimulation<SceneNode>;
  private nodes: SceneNode[] = [];
  private links: SceneLink[] = [];
  private nodeById = new Map<string, SceneNode>();
  private neighbors = new Map<SceneNode, Set<SceneNode>>();
  private data: GraphData = { nodes: [], links: [] };

  private camera: Camera = { x: 0, y: 0, scale: 1 };
  private cameraTarget: Camera | null = null;
  /** Keep the whole graph framed until the user takes over the camera. */
  private followFit = true;

  private width = 0;
  private height = 0;
  /** Screen space covered by UI, which framing should avoid. */
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private pixelRatio = 1;

  private hovered: SceneNode | null = null;
  private highlighted: Set<string> | null = null;
  private gesture: Gesture | null = null;
  private pointers = new Map<number, Point>();
  private listeners: ListenerMap = {};

  private raf = 0;
  private lastFrame = 0;
  private replayState: { start: number; duration: number; order: string[]; shown: number } | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    options: PartialOptions = {},
  ) {
    this.options = mergeOptions(DEFAULT_OPTIONS, options);
    this.sim = new ForceSimulation<SceneNode>({ ...this.options.forces });

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not supported");
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.onDoubleClick);
  }

  // ── Public API ────────────────────────────────────────────────────────

  setData(data: GraphData): void {
    this.replayState = null;
    this.data = data;
    this.applyData(data);
  }

  setOptions(options: PartialOptions): void {
    const forcesChanged =
      options.forces &&
      Object.entries(options.forces).some(([k, v]) => this.options.forces[k as keyof RendererOptions["forces"]] !== v);
    this.options = mergeOptions(this.options, options);
    if (forcesChanged) {
      this.sim.forces = { ...this.options.forces };
      this.sim.reheat(0.4);
    }
    this.schedule();
  }

  /** Emphasise these nodes as if hovered (e.g. search matches). `null` clears. */
  setHighlighted(ids: Iterable<string> | null): void {
    const next = ids ? new Set(ids) : null;
    this.highlighted = next && next.size > 0 ? next : null;
    this.schedule();
  }

  /** Tells framing which edges of the canvas are covered by overlaid UI, in CSS pixels. */
  setInsets(insets: Partial<Insets>): void {
    this.insets = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    if (this.followFit) this.cameraTarget = this.fitCamera();
    this.schedule();
  }

  /** Smoothly frames the whole graph, and keeps framing it while it settles. */
  zoomToFit(): void {
    this.followFit = true;
    this.cameraTarget = this.fitCamera();
    this.schedule();
  }

  zoomBy(factor: number): void {
    this.followFit = false;
    const base = this.cameraTarget ?? this.camera;
    this.cameraTarget = { ...base, scale: clamp(base.scale * factor, MIN_SCALE, MAX_SCALE) };
    this.schedule();
  }

  /** Shakes the layout loose from where it settled. */
  reheat(alpha = 1): void {
    this.sim.reheat(alpha);
    this.schedule();
  }

  /** Rebuilds the graph node by node, in the order they were given. */
  replay(durationMs = 4000): void {
    const order = this.data.nodes.map((n) => n.id);
    this.applyData({ nodes: [], links: [] });
    this.followFit = true;
    this.replayState = { start: performance.now(), duration: Math.max(1, durationMs), order, shown: 0 };
    this.schedule();
  }

  get isReplaying(): boolean {
    return this.replayState !== null;
  }

  screenToWorld(p: Point): Point {
    const { x, y, scale } = this.camera;
    return { x: (p.x - this.width / 2) / scale + x, y: (p.y - this.height / 2) / scale + y };
  }

  worldToScreen(p: Point): Point {
    const { x, y, scale } = this.camera;
    return { x: (p.x - x) * scale + this.width / 2, y: (p.y - y) * scale + this.height / 2 };
  }

  getNodePosition(id: string): Point | null {
    const n = this.nodeById.get(id);
    return n ? { x: n.x, y: n.y } : null;
  }

  on<K extends keyof RendererEvents>(event: K, listener: Listener<K>): () => void {
    const listeners = this.listeners as Record<string, Set<Listener<K>>>;
    const set = (listeners[event] ??= new Set());
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /** Renders the settled graph, cropped to its bounds, as a PNG. */
  async toPNG(options: ExportOptions & { maxSize?: number } = {}): Promise<Blob> {
    const padding = options.padding ?? FIT_PADDING;
    const box = this.worldBounds();
    const worldW = box.right - box.left + padding * 2;
    const worldH = box.bottom - box.top + padding * 2;
    const scale = Math.min(options.scale ?? 2, (options.maxSize ?? 4096) / Math.max(worldW, worldH));

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(worldW * scale);
    canvas.height = Math.ceil(worldH * scale);
    const ctx = canvas.getContext("2d")!;
    const theme = { ...this.options.theme };
    if (options.transparent) theme.background = null;
    drawScene(
      ctx,
      this.nodes.map((n) => ({ ...n, fade: 1, accent: 0, emphasis: 0, appear: 1 })),
      this.links.map((l) => ({ ...l, fade: 1, accent: 0 })),
      { ...this.options, theme },
      {
        camera: { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, scale: 1 },
        width: worldW,
        height: worldH,
        pixelRatio: scale,
      },
      { labelOpacity: options.labels === false ? 0 : 1 },
    );
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
  }

  toSVG(options: ExportOptions = {}): string {
    return buildSvg(this.nodes, this.links, this.options, this.worldBounds(), options);
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.canvas.remove();
    this.listeners = {};
  }

  // ── Data ──────────────────────────────────────────────────────────────

  private applyData(data: GraphData): void {
    const previous = this.nodeById;
    const previousLinks = new Map(this.links.map((l) => [linkKey(l.source.id, l.target.id), l]));

    const nodes: SceneNode[] = [];
    const byId = new Map<string, SceneNode>();
    const fresh: SceneNode[] = [];
    for (const input of data.nodes) {
      if (byId.has(input.id)) continue;
      let node = previous.get(input.id);
      if (!node) {
        node = {
          id: input.id,
          label: "",
          color: null,
          sizeMul: 1,
          x: input.x ?? NaN,
          y: input.y ?? NaN,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
          degree: 0,
          fade: 1,
          accent: 0,
          emphasis: 0,
          appear: 0,
        };
        fresh.push(node);
      }
      node.label = input.label ?? input.id;
      node.color = input.color ?? null;
      node.sizeMul = input.size ?? 1;
      byId.set(input.id, node);
      nodes.push(node);
    }

    // Nothing survived (first load, a new template): lay out from scratch.
    const startingOver = nodes.length > 0 && fresh.length === nodes.length;

    const links: SceneLink[] = [];
    const seen = new Set<string>();
    for (const input of data.links) {
      const source = byId.get(input.source);
      const target = byId.get(input.target);
      if (!source || !target) continue;
      const key = linkKey(source.id, target.id);
      if (seen.has(key)) continue;
      seen.add(key);
      const old = previousLinks.get(key);
      links.push({ source, target, fade: old?.fade ?? 1, accent: old?.accent ?? 0 });
    }

    const neighbors = new Map<SceneNode, Set<SceneNode>>(nodes.map((n) => [n, new Set()]));
    for (const { source, target } of links) {
      neighbors.get(source)!.add(target);
      neighbors.get(target)!.add(source);
    }

    this.nodes = nodes;
    this.links = links;
    this.nodeById = byId;
    this.neighbors = neighbors;
    if (this.hovered && !byId.has(this.hovered.id)) this.hovered = null;

    const restructured =
      fresh.length > 0 ||
      nodes.length !== previous.size ||
      links.length !== previousLinks.size ||
      links.some((l) => !previousLinks.has(linkKey(l.source.id, l.target.id)));

    this.placeNewNodes(fresh, startingOver);
    this.sim.setGraph(nodes, links);
    if (fresh.length > 0) this.sim.reheat(startingOver ? 1 : 0.5);
    else if (restructured) this.sim.reheat(0.3);
    if (startingOver) this.followFit = true;
    this.schedule();
  }

  /** Seeds new nodes next to an already-placed neighbour, or on a spiral. */
  private placeNewNodes(fresh: SceneNode[], startingOver: boolean): void {
    if (startingOver) {
      // Start the whole graph packed tight and let repulsion unfold it: an
      // expanding layout untangles itself far better than one seeded wide.
      fresh.forEach((node, i) => {
        if (!Number.isNaN(node.x) && !Number.isNaN(node.y)) return;
        const r = 10 * Math.sqrt(i + 0.5);
        const angle = i * GOLDEN_ANGLE;
        node.x = Math.cos(angle) * r;
        node.y = Math.sin(angle) * r;
      });
      return;
    }
    const spread = Math.max(this.options.forces.linkDistance * 0.25, 20);
    let spiral = 0;
    let pending = fresh.filter((n) => Number.isNaN(n.x) || Number.isNaN(n.y));
    while (pending.length > 0) {
      const stuck: SceneNode[] = [];
      for (const node of pending) {
        const anchor = [...this.neighbors.get(node)!].find((n) => !Number.isNaN(n.x));
        if (anchor) {
          const angle = Math.random() * Math.PI * 2;
          node.x = anchor.x + Math.cos(angle) * spread;
          node.y = anchor.y + Math.sin(angle) * spread;
        } else {
          stuck.push(node);
        }
      }
      if (stuck.length === pending.length) {
        // Nothing to anchor to: start one on a golden-angle spiral and retry.
        const node = stuck.shift()!;
        const centre = this.centroid();
        const r = spread * Math.sqrt(++spiral) * 2;
        const angle = spiral * GOLDEN_ANGLE;
        node.x = centre.x + Math.cos(angle) * r;
        node.y = centre.y + Math.sin(angle) * r;
      }
      pending = stuck;
    }
  }

  private centroid(): Point {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const node of this.nodes) {
      if (Number.isNaN(node.x)) continue;
      x += node.x;
      y += node.y;
      n++;
    }
    return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
  }

  private advanceReplay(now: number): boolean {
    const state = this.replayState;
    if (!state) return false;
    const progress = Math.min(1, (now - state.start) / state.duration);
    const count = Math.ceil(progress * state.order.length);
    if (count !== state.shown) {
      state.shown = count;
      const visible = new Set(state.order.slice(0, count));
      this.applyData({
        nodes: this.data.nodes.filter((n) => visible.has(n.id)),
        links: this.data.links.filter((l) => visible.has(l.source) && visible.has(l.target)),
      });
    }
    if (progress >= 1) this.replayState = null;
    return true;
  }

  // ── Frame loop ────────────────────────────────────────────────────────

  private schedule(): void {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const dt = Math.min(64, this.lastFrame ? now - this.lastFrame : 16);
    this.lastFrame = now;

    let busy = this.advanceReplay(now);
    if (this.sim.active) {
      this.sim.tick();
      busy = true;
    }
    busy = this.animateFocus(dt) || busy;
    busy = this.animateCamera(dt) || busy;
    this.draw();

    if (busy) this.schedule();
    else this.lastFrame = 0;
  };

  private draw(): void {
    drawScene(
      this.ctx,
      this.nodes,
      this.links,
      this.options,
      { camera: this.camera, width: this.width, height: this.height, pixelRatio: this.pixelRatio },
      {
        connectPreview: this.gesture?.kind === "connect" ? { from: this.gesture.node, to: this.gesture.to } : null,
      },
    );
  }

  private animateFocus(dt: number): boolean {
    const focus = this.hovered ?? (this.gesture?.kind === "drag" ? this.gesture.node : null);
    const near = focus ? this.neighbors.get(focus)! : null;
    const highlighted = focus ? null : this.highlighted;
    const dim = this.options.dimOpacity;
    const fadeStep = 1 - Math.exp(-dt / FADE_TIME_MS);
    const appearStep = dt / APPEAR_TIME_MS;
    let busy = false;

    for (const n of this.nodes) {
      let fade = 1;
      let accent = 0;
      let emphasis = 0;
      if (focus) {
        const inFocus = n === focus || near!.has(n);
        fade = inFocus ? 1 : dim;
        accent = n === focus ? 1 : 0;
        emphasis = inFocus ? 1 : 0;
      } else if (highlighted) {
        const hit = highlighted.has(n.id);
        fade = hit ? 1 : dim;
        accent = hit ? 1 : 0;
        emphasis = hit ? 1 : 0;
      }
      n.fade = approach(n.fade, fade, fadeStep);
      n.accent = approach(n.accent, accent, fadeStep);
      n.emphasis = approach(n.emphasis, emphasis, fadeStep);
      if (n.appear < 1) n.appear = Math.min(1, n.appear + appearStep);
      busy ||= n.appear < 1 || Math.abs(n.fade - fade) + Math.abs(n.accent - accent) + Math.abs(n.emphasis - emphasis) > EPSILON;
    }

    for (const l of this.links) {
      let fade = 1;
      let accent = 0;
      if (focus) {
        const touches = l.source === focus || l.target === focus;
        fade = touches ? 1 : dim;
        accent = touches ? 1 : 0;
      } else if (highlighted) {
        const touches = highlighted.has(l.source.id) && highlighted.has(l.target.id);
        fade = touches ? 1 : dim;
      }
      l.fade = approach(l.fade, fade, fadeStep);
      l.accent = approach(l.accent, accent, fadeStep);
      busy ||= Math.abs(l.fade - fade) + Math.abs(l.accent - accent) > EPSILON;
    }
    return busy;
  }

  private animateCamera(dt: number): boolean {
    if (this.followFit && this.sim.active && !this.gesture) this.cameraTarget = this.fitCamera();
    const target = this.cameraTarget;
    if (!target) return false;
    const step = 1 - Math.exp(-dt / CAMERA_TIME_MS);
    const cam = this.camera;
    // Interpolate zoom in log space so zooming in and out feel symmetric.
    const logScale = Math.log(cam.scale) + (Math.log(target.scale) - Math.log(cam.scale)) * step;
    cam.scale = Math.exp(logScale);
    cam.x += (target.x - cam.x) * step;
    cam.y += (target.y - cam.y) * step;
    const done =
      Math.abs(Math.log(target.scale / cam.scale)) < 1e-3 &&
      Math.abs(target.x - cam.x) * cam.scale < 0.5 &&
      Math.abs(target.y - cam.y) * cam.scale < 0.5;
    if (done) {
      Object.assign(cam, target);
      this.cameraTarget = null;
      this.emit("zoom", { scale: cam.scale });
    }
    return !done;
  }

  private worldBounds(): { left: number; right: number; top: number; bottom: number } {
    if (this.nodes.length === 0) return { left: -100, right: 100, top: -100, bottom: 100 };
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    const labelRoom = 12 * this.options.textSize * 1.6;
    for (const n of this.nodes) {
      const r = nodeRadius({ ...n, appear: 1 }, this.options);
      left = Math.min(left, n.x - r);
      right = Math.max(right, n.x + r);
      top = Math.min(top, n.y - r);
      bottom = Math.max(bottom, n.y + r + labelRoom);
    }
    return { left, right, top, bottom };
  }

  private fitCamera(): Camera {
    const b = this.worldBounds();
    const w = Math.max(b.right - b.left, 1);
    const h = Math.max(b.bottom - b.top, 1);
    const { top, right, bottom, left } = this.insets;
    const availW = Math.max(this.width - left - right - FIT_PADDING * 2, 50);
    const availH = Math.max(this.height - top - bottom - FIT_PADDING * 2, 50);
    const scale = clamp(Math.min(availW / w, availH / h), MIN_SCALE, 2);
    // Centre the graph in the uncovered area rather than the whole canvas.
    return {
      x: (b.left + b.right) / 2 - (left - right) / 2 / scale,
      y: (b.top + b.bottom) / 2 - (top - bottom) / 2 / scale,
      scale,
    };
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    // Repaint synchronously so the canvas never flashes blank mid-resize.
    this.draw();
    this.schedule();
  }

  // ── Interaction ───────────────────────────────────────────────────────

  private localPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private nodeAt(screen: Point): SceneNode | null {
    const world = this.screenToWorld(screen);
    const slop = 4 / this.camera.scale;
    let best: SceneNode | null = null;
    let bestDistance = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - world.x, n.y - world.y);
      if (d <= nodeRadius(n, this.options) + slop && d < bestDistance) {
        best = n;
        bestDistance = d;
      }
    }
    return best;
  }

  private setHovered(node: SceneNode | null): void {
    if (node === this.hovered) return;
    this.hovered = node;
    this.emit("nodeHover", { id: node?.id ?? null });
    this.schedule();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    this.canvas.setPointerCapture(e.pointerId);

    if (this.pointers.size === 2) {
      this.releaseDrag();
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), scale: this.camera.scale, center: midpoint(a, b) };
      return;
    }

    const node = this.nodeAt(p);
    if (node && e.shiftKey) {
      this.gesture = { kind: "connect", pointerId: e.pointerId, node, to: { x: node.x, y: node.y } };
    } else if (node) {
      node.fx = node.x;
      node.fy = node.y;
      this.gesture = { kind: "drag", pointerId: e.pointerId, node, startX: p.x, startY: p.y, moved: false };
      this.canvas.style.cursor = "grabbing";
    } else {
      this.gesture = { kind: "pan", pointerId: e.pointerId, startX: p.x, startY: p.y, camX: this.camera.x, camY: this.camera.y, moved: false };
    }
    this.schedule();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.localPoint(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    const g = this.gesture;

    if (!g) {
      const node = this.nodeAt(p);
      this.setHovered(node);
      this.canvas.style.cursor = node ? "pointer" : "default";
      return;
    }

    switch (g.kind) {
      case "pinch": {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        this.followFit = false;
        this.zoomAround(midpoint(a, b), (g.scale * distance) / g.distance / this.camera.scale);
        return;
      }
      case "pan": {
        if (e.pointerId !== g.pointerId) return;
        const dx = p.x - g.startX;
        const dy = p.y - g.startY;
        if (!g.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
        if (!g.moved) {
          g.moved = true;
          this.followFit = false;
          this.cameraTarget = null;
          this.canvas.style.cursor = "grabbing";
        }
        this.camera.x = g.camX - dx / this.camera.scale;
        this.camera.y = g.camY - dy / this.camera.scale;
        this.schedule();
        return;
      }
      case "drag": {
        if (e.pointerId !== g.pointerId) return;
        if (!g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) < CLICK_SLOP) return;
        if (!g.moved) {
          g.moved = true;
          this.sim.alphaTarget = 0.3;
          this.sim.reheat(0.3);
        }
        const world = this.screenToWorld(p);
        g.node.fx = world.x;
        g.node.fy = world.y;
        this.schedule();
        return;
      }
      case "connect": {
        g.to = this.screenToWorld(p);
        const over = this.nodeAt(p);
        this.setHovered(over && over !== g.node ? over : null);
        this.schedule();
        return;
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    const p = this.localPoint(e);

    if (g.kind === "pinch") {
      if (this.pointers.size === 0) this.gesture = null;
      return;
    }
    if (g.pointerId !== e.pointerId) return;
    this.gesture = null;

    if (g.kind === "drag") {
      this.releaseDrag(g.node);
      if (!g.moved) this.emit("nodeClick", { id: g.node.id, event: e });
    } else if (g.kind === "pan") {
      if (!g.moved) this.emit("backgroundClick", { world: this.screenToWorld(p), event: e });
    } else if (g.kind === "connect") {
      const target = this.nodeAt(p);
      if (target && target !== g.node) this.emit("connect", { source: g.node.id, target: target.id });
    }

    const node = e.pointerType === "mouse" ? this.nodeAt(p) : null;
    this.setHovered(node);
    this.canvas.style.cursor = node ? "pointer" : "default";
    this.schedule();
  };

  private releaseDrag(node?: SceneNode): void {
    const target = node ?? (this.gesture?.kind === "drag" ? this.gesture.node : null);
    if (target) {
      target.fx = null;
      target.fy = null;
    }
    this.sim.alphaTarget = 0;
  }

  private onPointerLeave = (): void => {
    if (!this.gesture) this.setHovered(null);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.followFit = false;
    this.cameraTarget = null;
    // Trackpad pinches arrive as ctrl+wheel with small deltas; mice as big steps.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
    const speed = e.ctrlKey ? 0.01 : 0.0015;
    this.zoomAround(this.localPoint(e), Math.exp(-e.deltaY * unit * speed));
  };

  private onDoubleClick = (e: MouseEvent): void => {
    const p = this.localPoint(e);
    const node = this.nodeAt(p);
    if (node) this.emit("nodeDoubleClick", { id: node.id, event: e });
    else this.emit("backgroundDoubleClick", { world: this.screenToWorld(p), event: e });
  };

  private zoomAround(screen: Point, factor: number): void {
    const before = this.screenToWorld(screen);
    this.camera.scale = clamp(this.camera.scale * factor, MIN_SCALE, MAX_SCALE);
    const after = this.screenToWorld(screen);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.emit("zoom", { scale: this.camera.scale });
    this.schedule();
  }

  private emit<K extends keyof RendererEvents>(event: K, payload: RendererEvents[K]): void {
    const set = this.listeners[event] as Set<Listener<K>> | undefined;
    set?.forEach((listener) => listener(payload));
  }
}

function mergeOptions(base: RendererOptions, patch: PartialOptions): RendererOptions {
  return {
    ...base,
    ...patch,
    forces: { ...base.forces, ...patch.forces },
    theme: { ...base.theme, ...patch.theme },
  } as RendererOptions;
}

function linkKey(a: string, b: string): string {
  return `${a}\u0000${b}`;
}

function approach(current: number, target: number, step: number): number {
  const next = current + (target - current) * step;
  return Math.abs(target - next) < EPSILON ? target : next;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
