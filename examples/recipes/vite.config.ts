import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackWsr } from "@tinloof/tanstack-wsr/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		// The worker build (configFile:false) skips this plugin, and tanstackWsr
		// aliases the Solid-based devtools to a no-op so they stay out of /sw.js.
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		// Bundles a worker to /sw.js (from getRouter) that renders `wsr: true`
		// routes in-worker on document loads. Serves it fresh in dev; emits it on
		// build. SW-rendered pages hydrate via Start's own client bundle.
		tanstackWsr(),
		// Single route tree for the whole app (main thread + service worker).
		tanstackStart(),
		viteReact(),
	],
});
