export interface Template {
  id: string;
  name: string;
  source: () => string;
}

const DIJKSTRA = `# Weighted digraph for Dijkstra / Bellman–Ford.
# Turn on Display → "Weights set edge length" to lay it out by weight.
s -(7)-> a
s -(2)-> b
s -(9)-> c
a -(3)-> d
b -(4)-> a
b -(8)-> d
b -(6)-> e
c -(2)-> e
d -(1)-> t
e -(5)-> t
e -(3)-> d
`;

const SCC = `# Directed graph: three cycles (non-trivial SCCs) plus nodes on no cycle.
# Set Display → Colour by → Strongly connected component to see them.
a -> b -> c -> a
b -> d
d -> e -> f -> d
f -> g
g -> h -> i -> g
i -> j
c -> h
k
`;

const PREREQS = `# Course prerequisites: a DAG. Topological order = a valid schedule.
"CS 101" -> "CS 102" -> "Data Structures"
"Discrete Math" -> "Data Structures" -> Algorithms
"Data Structures" -> "Operating Systems", Databases
"Computer Architecture" -> "Operating Systems" -> "Distributed Systems"
Algorithms -> Compilers, "Machine Learning"
"Linear Algebra" -> "Machine Learning"
Databases -> "Distributed Systems"
`;

const PETERSEN = `# The Petersen graph: 3-regular, girth 5, the counterexample to everything.
o0 -- o1 -- o2 -- o3 -- o4 -- o0
o0 -- i0
o1 -- i1
o2 -- i2
o3 -- i3
o4 -- i4
i0 -- i2 -- i4 -- i1 -- i3 -- i0
`;

function binaryTree(): string {
  const lines = ["# Complete binary tree, depth 5, heap-indexed. Try Colour by → BFS depth."];
  for (let i = 1; i < 32; i++) lines.push(`${i} -> ${2 * i}, ${2 * i + 1}`);
  return lines.join("\n") + "\n";
}

function grid(): string {
  const n = 7;
  const lines = [`# ${n}×${n} grid graph.`];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const right = c + 1 < n ? [`${r},${c + 1}`] : [];
      const down = r + 1 < n ? [`${r + 1},${c}`] : [];
      const next = [...right, ...down].map((id) => `"${id}"`);
      if (next.length) lines.push(`"${r},${c}" -- ${next.join(", ")}`);
    }
  }
  return lines.join("\n") + "\n";
}

function complete(): string {
  const n = 7;
  const lines = [`# K${n}: every pair connected.`];
  for (let i = 0; i < n; i++) {
    const rest = Array.from({ length: n - i - 1 }, (_, k) => `v${i + k + 1}`);
    if (rest.length) lines.push(`v${i} -- ${rest.join(", ")}`);
  }
  return lines.join("\n") + "\n";
}

const STARTER = `# Edit this text, or draw on the canvas in edit mode (E).

graph -> renderer, website
renderer -> physics, camera, hover, labels
physics -> "link force", "repel force", "center force"
website -> editor, settings, export, "share link"
export -(2)-> PNG, SVG
settings -> themes, groups, forces
graph {2}
`;

const SOLAR = `Sun {#ffb703 4} -> Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
Earth {#4cc9f0 1.4} -> Moon
Mars {#e76f51} -> Phobos, Deimos
Jupiter {#f4a261 2.2} -> Io, Europa, Ganymede, Callisto
Saturn {#e9c46a 2} -> Titan, Enceladus, Rhea, Iapetus, Mimas
Uranus {#90e0ef 1.5} -> Titania, Oberon, Miranda
Neptune {#4361ee 1.5} -> Triton, Nereid
`;

const KNOWLEDGE = `# A tiny second brain
Zettelkasten -> "Atomic notes", "Linking", "Index notes"
"Atomic notes" -> "One idea per note", "Write in your own words"
Linking -> Backlinks, "Graph view", "Maps of content"
"Maps of content" -> "Index notes"
"Graph view" -> "Force layout", Clusters
"Force layout" -> Physics
Clusters -> "Emergent structure"
"Spaced repetition" -> Flashcards, "Active recall"
"Active recall" -> "Write in your own words"
"Daily notes" -> Journaling, "Fleeting notes"
"Fleeting notes" -> "Atomic notes"
Reading -> "Literature notes" -> "Atomic notes"
`;

const ORG = `CEO {#e63946 2.5} -> CTO, CFO, COO, CMO
CTO {#457b9d 1.6} -> "Platform lead", "Product eng lead", "Data lead"
"Platform lead" -> Infra, SRE, Security
"Product eng lead" -> Web, Mobile, Design
"Data lead" -> Analytics, ML
CFO {#2a9d8f 1.6} -> Finance, Legal
COO {#e9c46a 1.6} -> Ops, Support, People
CMO {#f4a261 1.6} -> Brand, Growth, Content
Growth <-> Analytics
Design -- Brand
`;

const NAMES = "ada alan grace linus ken dennis barbara margaret tim vint radia frances john edsger donald niklaus guido bjarne james larry".split(" ");

function socialNetwork(): string {
  const lines: string[] = [];
  const clusters = 5;
  const size = 14;
  const id = (c: number, i: number) => `${NAMES[(c * size + i) % NAMES.length]}${c * size + i}`;
  for (let c = 0; c < clusters; c++) {
    for (let i = 0; i < size; i++) {
      const peers = new Set<number>();
      const count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) peers.add(Math.floor(Math.random() * size));
      peers.delete(i);
      if (peers.size) lines.push(`${id(c, i)} -- ${[...peers].map((p) => id(c, p)).join(", ")}`);
    }
    lines.push(`${id(c, 0)} -- ${id((c + 1) % clusters, 0)}`);
  }
  return `# Random small-world network — hit the template again to reroll\n${lines.join("\n")}\n`;
}

function tree(): string {
  const lines: string[] = ["# Random tree"];
  let next = 1;
  const queue = [0];
  while (queue.length && next < 120) {
    const parent = queue.shift()!;
    const kids = 1 + Math.floor(Math.random() * 4);
    const children = Array.from({ length: kids }, () => next++);
    lines.push(`n${parent} -> ${children.map((c) => `n${c}`).join(", ")}`);
    queue.push(...children);
  }
  lines.push("n0 {#f72585 3}");
  return lines.join("\n") + "\n";
}

function galaxy(): string {
  const lines: string[] = ["# Hubs and their orbits"];
  const hubs = 6;
  for (let h = 0; h < hubs; h++) {
    const spokes = 12 + Math.floor(Math.random() * 24);
    lines.push(`hub${h} {${(1.5 + Math.random() * 2).toFixed(1)}} -> ${Array.from({ length: spokes }, (_, i) => `s${h}.${i}`).join(", ")}`);
    if (h > 0) lines.push(`hub${h} -- hub${Math.floor(Math.random() * h)}`);
  }
  return lines.join("\n") + "\n";
}

export const TEMPLATES: Template[] = [
  { id: "starter", name: "Starter", source: () => STARTER },
  { id: "dijkstra", name: "Shortest paths (weighted)", source: () => DIJKSTRA },
  { id: "scc", name: "Strongly connected components", source: () => SCC },
  { id: "prereqs", name: "Course prerequisites (DAG)", source: () => PREREQS },
  { id: "binary-tree", name: "Binary tree", source: binaryTree },
  { id: "petersen", name: "Petersen graph", source: () => PETERSEN },
  { id: "grid", name: "Grid graph", source: grid },
  { id: "complete", name: "Complete graph K7", source: complete },
  { id: "knowledge", name: "Second brain", source: () => KNOWLEDGE },
  { id: "solar", name: "Solar system", source: () => SOLAR },
  { id: "org", name: "Org chart", source: () => ORG },
  { id: "social", name: "Social network", source: socialNetwork },
  { id: "tree", name: "Random tree", source: tree },
  { id: "galaxy", name: "Galaxy", source: galaxy },
];
