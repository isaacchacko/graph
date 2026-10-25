import type { Metadata } from "next";
import { GraphEmbed } from "@/components/GraphEmbed";

export const metadata: Metadata = {
  title: "graph",
  robots: { index: false },
};

export default function Embed() {
  return <GraphEmbed />;
}
