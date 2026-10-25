import type { GraphData, InteractionMode, PartialOptions } from "@isaacchacko/graph";
import { decorate, type Group, type Settings } from "./state";
import type { AppTheme } from "./themes";

/** The parsed graph as the canvas draws it under these groups, settings and theme. */
export function renderData(data: GraphData, groups: Group[], settings: Settings, theme: AppTheme): GraphData {
  return decorate(data, groups, settings, { categories: theme.palette, low: theme.graph.node, high: theme.graph.accent });
}

export function renderOptions(settings: Settings, theme: AppTheme, mode: InteractionMode): PartialOptions {
  const { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows } = settings;
  return { forces, nodeSize, linkThickness, textSize, textFadeThreshold, arrows, mode, theme: theme.graph };
}
