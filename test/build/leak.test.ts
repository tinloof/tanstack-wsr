import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundleWorker } from "../../src/vite";

// In-process build of a fixture that uses createServerFn, createServerOnlyFn and
// an ordinary component, then assertions on the emitted worker code string. This
// is the core proof that server-only code never leaks into /sw.js while the
// worker stays a browser-grade (client-compiled) bundle.
//
// Resolves @tanstack/react-start from the repo root (a devDependency), so it runs
// with the default process.cwd() — no chdir needed. The dev build is unminified
// (readable identifiers); the prod build is minified (names mangled), so we only
// assert on string literals there (secrets / the RPC base URL survive minify).

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(here, "../fixtures/leak/entry.tsx");

const TIMEOUT = 60_000; // a real Vite/Rolldown build

function buildWorker(dev: boolean) {
	return bundleWorker(
		{ entry: ENTRY },
		dev,
		(abs) => `/${path.basename(abs)}`,
		"/client-entry.js",
	);
}

describe("bundleWorker leak/parity", () => {
	it(
		"dev worker: server fns compile to RPCs, server-only bodies are stripped, client code ships",
		async () => {
			const code = await buildWorker(true);

			// createServerFn -> network RPC (unminified, so the name is present).
			expect(code).toContain("createClientRpc");
			// createServerOnlyFn -> throw stub.
			expect(code).toContain("can only be called on the server");

			// Neither server-only body's secret reaches the worker.
			expect(code).not.toContain("LEAK_SERVERFN_a1b2c3");
			expect(code).not.toContain("LEAK_SERVERONLY_d4e5f6");

			// Ordinary client code DOES ship — only server-only bodies are stripped.
			expect(code).toContain("CLIENT_VISIBLE_g7h8i9");

			// ?url asset maps to the caller-provided URL (not a duplicate stylesheet).
			expect(code).toContain("/style.css");

			// No Solid (devtools) pulled into the worker.
			expect(code).not.toContain("solid-js");
		},
		TIMEOUT,
	);

	it(
		"prod (minified) worker: still no server-only secret leaks, RPC wiring intact",
		async () => {
			const code = await buildWorker(false);
			// Secrets are string literals — minification preserves strings, so their
			// ABSENCE here is a real no-leak signal even in the production bundle.
			expect(code).not.toContain("LEAK_SERVERFN_a1b2c3");
			expect(code).not.toContain("LEAK_SERVERONLY_d4e5f6");
			// The server-fn RPC base URL survives minification, proving the call site
			// was compiled to a fetch RPC rather than inlined as a server body.
			expect(code).toContain("/_serverFn/");
		},
		TIMEOUT,
	);
});
