import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bundleWorker } from "../../src/vite";

// Regression test for the bug where the SW build crashed / leaked for apps with
// SERVER ROUTES. A pure-server route (`createFileRoute({ server: {...} })`) and
// its server-only import must be PRUNED from /sw.js — exactly as Start prunes
// them from the app's own client build — and the build must not crash.
//
// This drives the DEFAULT router-derived entry (no `options.entry`), which is
// the path that runs Start's route-tree pruning (the leak.test covers the
// custom-entry / server-fn path). bundleWorker reads process.cwd(), so we chdir
// into a minimal Start-app fixture. Vitest isolates files in separate processes,
// so the chdir doesn't affect other test files; we restore it regardless.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const appDir = path.resolve(here, "../fixtures/server-route-app");
const routeTreePath = path.join(appDir, "src/routeTree.gen.ts");
// The generated worker entry imports `@tinloof/tanstack-wsr/worker`; real apps
// resolve it from node_modules. The fixture has none, so link the package (this
// repo) in so resolution works exactly as in a consumer app.
const linkDir = path.join(appDir, "node_modules/@tinloof");
const linkPath = path.join(linkDir, "tanstack-wsr");

const TIMEOUT = 60_000;

let prevCwd: string;
let routeTreeBackup: string;

beforeAll(() => {
	prevCwd = process.cwd();
	// The router generator may rewrite the committed route tree during the build;
	// snapshot it so the fixture stays deterministic in git.
	routeTreeBackup = fs.readFileSync(routeTreePath, "utf8");
	fs.mkdirSync(linkDir, { recursive: true });
	fs.rmSync(linkPath, { force: true, recursive: true });
	fs.symlinkSync(repoRoot, linkPath, "dir");
	process.chdir(appDir);
});

afterAll(() => {
	process.chdir(prevCwd);
	fs.writeFileSync(routeTreePath, routeTreeBackup);
	fs.rmSync(path.join(appDir, "node_modules"), { force: true, recursive: true });
});

function buildWorker(dev: boolean) {
	return bundleWorker(
		{}, // default router entry → route-tree pruning runs
		dev,
		(abs) => `/${path.basename(abs)}`,
		"/client-entry.js",
	);
}

describe("bundleWorker server-route pruning", () => {
	it(
		"dev: builds without crashing and prunes the pure-server route + its server-only import",
		async () => {
			const code = await buildWorker(true);

			// The server route's server-only dependency must not reach /sw.js…
			expect(code).not.toContain("LEAK_SERVER_ROUTE_zzz999");
			// …nor its route path (the pure-server node is pruned from the tree).
			expect(code).not.toContain("/api/secret");
			// The ordinary client route still ships.
			expect(code).toContain("CLIENT_INDEX_VISIBLE_marker");
			// The output is the actual WORKER (its SW runtime is present), not the
			// app's client bundle — guards against the build being hijacked away from
			// our worker entry (which would still pass the assertions above).
			expect(code).toMatch(/skipWaiting|clients\.claim|addEventListener\(["']fetch/);
		},
		TIMEOUT,
	);

	it(
		"dev: the client route's server fn is compiled to an RPC with a DEV-style id that matches the dev server (so server fns called during the in-worker render work in dev)",
		async () => {
			const code = await buildWorker(true);
			const ids = [
				...code.matchAll(/createClientRpc\(\s*["'`]([^"'`]+)["'`]/g),
			].map((m) => m[1]);
			// The server fn became a network RPC…
			expect(ids.length).toBeGreaterThan(0);
			// …with a dev id (module-specifier encoding), NOT a build sha256 hash —
			// otherwise it would 404 against the dev server. This pins the behavior
			// that `withForcedDevMode` restores on top of route pruning.
			expect(ids.every((id) => !/^[a-f0-9]{64}$/.test(id))).toBe(true);
		},
		TIMEOUT,
	);

	it(
		"prod (minified): server-only secret still absent",
		async () => {
			const code = await buildWorker(false);
			// String literals survive minification, so absence is a real no-leak signal.
			expect(code).not.toContain("LEAK_SERVER_ROUTE_zzz999");
		},
		TIMEOUT,
	);
});
