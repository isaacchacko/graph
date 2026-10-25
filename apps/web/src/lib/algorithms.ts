import type { GraphData } from "@isaacchacko/graph";

/** Weakly connected components: ignores direction. Index per node id. */
export function connectedComponents(data: GraphData): Map<string, number> {
  const parent = new Map(data.nodes.map((n) => [n.id, n.id]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  for (const { source, target } of data.links) {
    if (parent.has(source) && parent.has(target)) parent.set(find(source), find(target));
  }
  return indexByRoot(data, find);
}

/** Strongly connected components (Tarjan), iterative so deep graphs cannot overflow the stack. */
export function stronglyConnectedComponents(data: GraphData): Map<string, number> {
  const out = adjacency(data, true);
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const component = new Map<string, number>();
  let counter = 0;
  let components = 0;

  for (const root of data.nodes.map((n) => n.id)) {
    if (index.has(root)) continue;
    const work: { id: string; next: number }[] = [{ id: root, next: 0 }];
    index.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);

    while (work.length) {
      const frame = work[work.length - 1];
      const edges = out.get(frame.id)!;
      if (frame.next < edges.length) {
        const w = edges[frame.next++];
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter++);
          stack.push(w);
          onStack.add(w);
          work.push({ id: w, next: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(w)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].id;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.id)!));
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.set(w, components);
        } while (w !== frame.id);
        components++;
      }
    }
  }
  return component;
}

/** Hops from the nearest root, where each component's root is its first-written node. Ignores direction. */
export function bfsDepth(data: GraphData): Map<string, number> {
  const neighbours = adjacency(data, false);
  const depth = new Map<string, number>();
  for (const { id: root } of data.nodes) {
    if (depth.has(root)) continue;
    depth.set(root, 0);
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      for (const w of neighbours.get(v)!) {
        if (depth.has(w)) continue;
        depth.set(w, depth.get(v)! + 1);
        queue.push(w);
      }
    }
  }
  return depth;
}

export function degrees(data: GraphData): Map<string, number> {
  const degree = new Map(data.nodes.map((n) => [n.id, 0]));
  for (const { source, target } of data.links) {
    if (degree.has(source)) degree.set(source, degree.get(source)! + 1);
    if (degree.has(target)) degree.set(target, degree.get(target)! + 1);
  }
  return degree;
}

function adjacency(data: GraphData, directed: boolean): Map<string, string[]> {
  const adj = new Map(data.nodes.map((n) => [n.id, [] as string[]]));
  for (const { source, target } of data.links) {
    if (!adj.has(source) || !adj.has(target)) continue;
    adj.get(source)!.push(target);
    if (!directed) adj.get(target)!.push(source);
  }
  return adj;
}

/** Numbers components 0, 1, 2… in order of their first-written node. */
function indexByRoot(data: GraphData, rootOf: (id: string) => string): Map<string, number> {
  const numbering = new Map<string, number>();
  const result = new Map<string, number>();
  for (const { id } of data.nodes) {
    const root = rootOf(id);
    if (!numbering.has(root)) numbering.set(root, numbering.size);
    result.set(id, numbering.get(root)!);
  }
  return result;
}
