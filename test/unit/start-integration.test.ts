import { describe, expect, it } from "vitest";
import { getServerFnClientPlugin, withForcedDevMode } from "../../src/vite";

// These pin the two pieces coupled to TanStack Start internals — the ones most
// likely to break on a Start upgrade. If Start renames the server-fn plugin or
// changes its hook shape / PluginContext, these fail loudly (pair with the
// prod-build id-match e2e for the runtime guarantee).
//
// The "Start not installed -> null" fallback is exercised by serverCodeGuard's
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

describe("withForcedDevMode", () => {
	function makeCtx() {
		return {
			environment: { mode: "build", name: "client" },
			load: () => "loaded",
			error: () => {
				throw new Error("err");
			},
		};
	}

	it("forces environment.mode to 'dev' in the transform {handler} hook", () => {
		let seenMode: unknown;
		let seenName: unknown;
		const plugin = {
			name: "fake",
			transform: {
				filter: {},
				handler(this: { environment: { mode: string; name: string } }) {
					seenMode = this.environment.mode;
					seenName = this.environment.name;
				},
			},
		} as never;
		const wrapped = withForcedDevMode(plugin);
		const ctx = makeCtx();
		(wrapped.transform as { handler: (this: object) => void }).handler.call(ctx);
		expect(seenMode).toBe("dev"); // forced
		expect(seenName).toBe("client"); // non-mode props pass through
		expect(ctx.environment.mode).toBe("build"); // underlying ctx untouched
	});

	it("forces 'dev' in a bare-function hook (buildStart) and keeps methods callable", () => {
		let seenMode: unknown;
		let loadResult: unknown;
		const plugin = {
			name: "fake",
			buildStart(this: {
				environment: { mode: string };
				load: () => string;
			}) {
				seenMode = this.environment.mode;
				loadResult = this.load();
			},
		} as never;
		const wrapped = withForcedDevMode(plugin);
		(wrapped.buildStart as (this: object) => void).call(makeCtx());
		expect(seenMode).toBe("dev");
		expect(loadResult).toBe("loaded"); // bound method still works
	});
});
