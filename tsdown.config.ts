import { defineConfig } from "tsdown";

// One entry per public subpath. Peer deps (vite, react, @tanstack/*) are
// auto-externalized. ESM only; emits .js + .d.ts to dist/.
export default defineConfig({
  entry: [
    "src/vite.ts",
    "src/react.tsx",
    "src/worker.tsx",
    // Internal: the no-op devtools stand-in the worker build aliases to. Not a
    // public subpath; referenced by filesystem path from vite.ts.
    "src/devtools-stub.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
});
