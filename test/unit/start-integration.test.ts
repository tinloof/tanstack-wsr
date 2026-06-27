import { describe, expect, it } from "vitest";
import { getServerFnClientPlugin, getStartWorkerPlugins } from "../../src/vite";

// These pin the pieces coupled to TanStack Start internals — the ones most
// likely to break on a Start upgrade. If Start renames a plugin or changes its
// hook shape / PluginContext, these fail loudly (pair with the prod-build
// id-match e2e for the runtime guarantee).
//
// The "Start not installed -> null/[]" fallback is exercised by serverCodeGuard's
// own unit test; we don't assert it here because Node/Vitest module resolution
// makes a true "unresolvable" temp dir unreliable in-process.

describe("getServerFnClientPlugin", () => {
	it("extracts Start's client server-fn compiler from the app root", async () => {
		// Repo root has @tanstack/react-start as a devDependency.
		const plugin = await getServerFnClientPlugin(process.cwd());
		expect(plugin).not.toBeNull();
		expect(plugin?.name).toBe("tanstack-start-core::server-fn:client");
		// Must run before the rest of the graph (compiles createServerFn first)…
		expect(plugin?.enforce).toBe("pre");
		// …and we force it to run regardless of the standalone build's env name.
		const applies = (
			plugin as { applyToEnvironment?: () => boolean }
		).applyToEnvironment?.();
		expect(applies).toBe(true);
	});
});

describe("getStartWorkerPlugins", () => {
	it("pulls route-tree pruning + the server-fn compiler so server-only route code never reaches /sw.js", async () => {
		const plugins = await getStartWorkerPlugins(process.cwd());
		const names = plugins.map((p) => p.name);
		// Route pruning: the generator crawls routes; the client-tree plugin serves
		// a tree with pure-server routes removed (their modules never imported).
		expect(names).toContain("tanstack:router-generator");
		expect(names).toContain("tanstack-start:route-tree-client-plugin");
		// …plus the server-fn → RPC compiler.
		expect(names).toContain("tanstack-start-core::server-fn:client");
		// The client-tree plugin is forced into our standalone env (its default
		// applyToEnvironment only matches Vite's "client" env).
		const clientTree = plugins.find(
			(p) => p.name === "tanstack-start:route-tree-client-plugin",
		) as { applyToEnvironment?: () => boolean } | undefined;
		expect(clientTree?.applyToEnvironment?.()).toBe(true);
	});
});
