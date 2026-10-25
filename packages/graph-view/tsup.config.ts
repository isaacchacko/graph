import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", element: "src/element.ts", react: "src/react.tsx" },
    format: ["esm"],
    dts: true,
    target: "es2020",
    external: ["react"],
  },
  {
    entry: { "graph-view": "src/browser.ts" },
    format: ["iife"],
    globalName: "GraphView",
    minify: true,
    target: "es2020",
    outExtension: () => ({ js: ".js" }),
  },
]);
