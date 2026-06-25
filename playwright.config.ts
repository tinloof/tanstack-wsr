import { defineConfig, devices } from "@playwright/test";

// Service workers only run in a real browser (not jsdom), so the SW
// register/render/hydrate behavior is covered here against the recipes example
// dev server. localhost is a secure context, so the SW is allowed over http.
const PORT = 3000;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "on-first-retry",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "pnpm -C examples/recipes dev",
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
