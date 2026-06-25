import { defineConfig } from "vitest/config";

// Unit + in-process-build tests run in Node (no DOM): the plugin logic is pure,
// and service-worker behavior is covered by Playwright (see e2e/), since service
// workers don't run in jsdom. Build-string tests spin a real Vite build, so they
// set their own longer per-test timeout.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    // e2e/ is Playwright's; keep it out of Vitest.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
