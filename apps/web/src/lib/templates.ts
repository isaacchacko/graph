export interface Template {
  id: string;
  name: string;
  source: () => string;
}

const STARTER = `# Edit this text or the canvas: the hints below show how.

graph -> renderer, website
renderer -> physics, camera, hover, labels
physics -> "link force", "repel force", "center force"
website -> editor, settings, export, "share link"
export -(2)-> PNG, SVG
settings -> themes, groups, forces
graph {#8f7cf7 2}
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
  { id: "knowledge", name: "Second brain", source: () => KNOWLEDGE },
  { id: "solar", name: "Solar system", source: () => SOLAR },
  { id: "org", name: "Org chart", source: () => ORG },
  { id: "social", name: "Social network", source: socialNetwork },
  { id: "tree", name: "Random tree", source: tree },
  { id: "galaxy", name: "Galaxy", source: galaxy },
];
