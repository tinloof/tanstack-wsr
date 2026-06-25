import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";

// The no-op devtools stand-in shipped alongside this module (see
// src/devtools-stub.ts). At runtime this file is dist/vite.mjs, so the stub is
// its sibling dist/devtools-stub.mjs. The worker build aliases the Solid-based
// devtools packages to it (see resolve.alias in bundleWorker).
const DEVTOOLS_STUB = fileURLToPath(
	new URL("./devtools-stub.mjs", import.meta.url),
);

// FALLBACK guard, used ONLY when Start's client server-fn compiler couldn't be
// loaded (see getServerFnClientPlugin returning null — e.g. @tanstack/react-start
// not resolvable). Normally the compiler runs and the worker has full browser
// parity: `createServerFn` → a network RPC, `createServerOnlyFn` → a throw stub,
// `createIsomorphicFn().server()` → only `.client` kept — none leak, exactly as
// in the app's client bundle. So when the compiler IS present this guard is not
// installed at all (it would false-positive on the safe `createServerOnlyFn`
// throw stub). When the compiler is ABSENT, server bodies would be bundled raw,
// so we fail the build loudly rather than silently shipping secrets in /sw.js.
/** @internal exported for tests; not part of the public API. */
export function serverCodeGuard(appSrc: string): Plugin {
	const offenders = new Set<string>();
	const SERVER_MARKERS =
		/\bcreateServerFn\b|\bcreateServerOnlyFn\b|['"]use server['"]/;
	return {
		name: "tanstack-wsr:server-code-guard",
		transform(code, id) {
			const clean = id.split("?")[0];
			if (clean.startsWith(appSrc) && SERVER_MARKERS.test(code)) {
				offenders.add(clean);
			}
			return null;
		},
		buildEnd() {
			if (offenders.size === 0) return;
			const list = [...offenders].map((f) => `  - ${f}`).join("\n");
			this.error(
				"tanstack-wsr: could not load TanStack Start's server-function compiler " +
					"(is @tanstack/react-start installed?), so server code in the worker " +
					"graph would ship to the browser in /sw.js. Ensure Start is resolvable " +
					"from the app root, or make these modules client-safe:\n" +
					list,
			);
		},
	};
}

// All bundling goes through Vite's own programmatic build() (Rolldown on Vite 8)
// rather than a separate esbuild pass, so the worker resolves modules through
// the same resolver/conditions as the app. The stubs below are ordinary Vite/
// Rollup plugins (resolveId/load) instead of esbuild's (onResolve/onLoad).

const NODE_STREAM_STUB_ID = "\0tanstack-wsr:node-stream";
const NODE_STREAM_STUB = `
  export default {};
  export class Readable {}
  export class Writable {}
  export class Duplex {}
  export class PassThrough {}
  export class Stream {}
  export const ReadableStream = globalThis.ReadableStream;
  export const WritableStream = globalThis.WritableStream;
  export const TransformStream = globalThis.TransformStream;
  export const ByteLengthQueuingStrategy = globalThis.ByteLengthQueuingStrategy;
  export const CountQueuingStrategy = globalThis.CountQueuingStrategy;
`;

// Satisfies the static `node:stream` / `node:stream/web` imports pulled in by
// TanStack's STREAMING SSR renderer (the worker only calls the *string* renderer,
// so this never executes). A browser service worker has no node:stream.
function nodeStreamStub(): Plugin {
	return {
		name: "tanstack-wsr:node-stream-stub",
		resolveId(id) {
			return /^node:stream(\/web)?$/.test(id) ? NODE_STREAM_STUB_ID : null;
		},
		load(id) {
			return id === NODE_STREAM_STUB_ID ? NODE_STREAM_STUB : null;
		},
	};
}

// The shared root statically imports the TanStack devtools (Solid-based) and
// renders them; they're never rendered in the worker, so the worker build
// aliases them to a no-op (DEVTOOLS_STUB) rather than bundle Solid — see
// resolve.alias in bundleWorker. (A resolveId plugin can't do this: Rolldown's
// native resolver doesn't call JS resolveId hooks for node_modules specifiers;
// an alias to a real file is what it honors.)
/** @internal exported for tests; not part of the public API. */
export const DEVTOOLS_ALIAS = {
	find: /^@tanstack\/(react-devtools|react-router-devtools|devtools|router-devtools-core)(\/.*)?$/,
	replacement: DEVTOOLS_STUB,
};

// Maps Vite's `*?url` asset imports (the shared root imports `../styles.css?url`)
// to a caller-provided URL. `enforce: 'pre'` so it intercepts before Vite's core
// asset handling — which, in this separate build, would otherwise emit a DUPLICATE
// stylesheet instead of pointing at the app's already-hashed one.
function urlAssetPlugin(resolveUrl: (absPath: string) => string): Plugin {
	// Opaque ids (no real extension) so Vite's core CSS/asset pipeline doesn't
	// claim them and turn our JS shim into a stylesheet.
	const idToAbs = new Map<string, string>();
	const absToId = new Map<string, string>();
	let n = 0;
	return {
		name: "tanstack-wsr:url-imports",
		enforce: "pre",
		resolveId(id, importer) {
			if (!id.endsWith("?url")) return null;
			const base = importer ? path.dirname(importer) : process.cwd();
			const abs = path.resolve(base, id.slice(0, -"?url".length));
			let vid = absToId.get(abs);
			if (!vid) {
				vid = `\0tanstack-wsr:url:${n++}`;
				absToId.set(abs, vid);
				idToAbs.set(vid, abs);
			}
			return vid;
		},
		load(id) {
			const abs = idToAbs.get(id);
			return abs ? `export default ${JSON.stringify(resolveUrl(abs))}` : null;
		},
	};
}

// Generates the worker entry (so apps need no worker file). Resolves a virtual id
// to a root-anchored fake module whose relative/bare imports resolve from the app
// root.
function swEntryPlugin(options: TanstackWsrOptions): Plugin {
	const router = options.router ?? "./src/router";
	// `.tsx` so it goes through the JSX transform; placed at the app root so the
	// generated imports resolve from there.
	const entryId = path.resolve(process.cwd(), "__tanstack-wsr-entry__.tsx");
	return {
		name: "tanstack-wsr:entry",
		resolveId(id) {
			return id === WSR_VIRTUAL_ENTRY ? entryId : null;
		},
		load(id) {
			if (id !== entryId) return null;
			return [
				`import { createWsrWorker } from "@tinloof/tanstack-wsr/worker";`,
				`import { getRouter } from ${JSON.stringify(router)};`,
				`createWsrWorker({ getRouter });`,
			].join("\n");
		},
	};
}

const SW_URL = "/sw.js";
const WSR_VIRTUAL_ENTRY = "virtual:tanstack-wsr-entry";

// TanStack Start's client hydration entry in dev (a Vite virtual module). In a
// build it's a hashed chunk, discovered from the client bundle (see below).
const DEV_CLIENT_ENTRY = "/@id/virtual:tanstack-start-dev-client-entry";

export interface TanstackWsrOptions {
	/**
	 * Module specifier (resolved from the app root) that exports `getRouter`.
	 * The plugin generates the worker entry from this, so no worker file is
	 * needed in the app.
	 * @default "./src/router"
	 */
	router?: string;
	/**
	 * Use your own worker entry file instead of the generated one (advanced —
	 * relative to the app root). When set, `router` is ignored.
	 */
	entry?: string;
}

// Start's default server-fn base path (router basepath `/` + `/_serverFn` + `/`).
// createClientRpc builds its URL as `process.env.TSS_SERVER_FN_BASE + id`, so the
// worker build must define this or the RPC stubs throw on `process` at init.
const DEFAULT_SERVER_FN_BASE = "/_serverFn/";

// Pulls Start's CLIENT server-function compiler plugin out of a FRESH
// `tanstackStart()` instance and adds it to the worker build. That plugin
// rewrites `createServerFn().handler(body)` to `createClientRpc(id)` (a fetch to
// the origin) for the `client` environment — so the worker renders a route whose
// component/loader references a server fn WITHOUT bundling the server body.
//
// A fresh instance (not the app's) avoids mutating the dev server's shared
// compiler cache (keyed by env name). We force `applyToEnvironment` on so it runs
// regardless of what Vite names this standalone build's environment, and the
// function ids it emits match the app's because both use Start's default
// `generateFunctionId`. Returns null if Start isn't installed (the guard then
// keeps its original "no server code" behavior).
/** @internal exported for tests; not part of the public API. */
export async function getServerFnClientPlugin(
	root: string = process.cwd(),
): Promise<Plugin | null> {
	// Resolve @tanstack/react-start from the APP (root), not from this package's
	// location — the app depends on Start, this package only peer-deps it. The
	// subpath is import-only (no `require` condition), so resolve the package dir
	// via its package.json and read the export map for the real file.
	let mod: { tanstackStart?: (opts?: unknown) => unknown };
	try {
		const req = createRequire(path.join(root, "package.json"));
		const pkgPath = req.resolve("@tanstack/react-start/package.json");
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
		const ent = pkg.exports?.["./plugin/vite"];
		const rel =
			typeof ent === "string"
				? ent
				: (ent?.import?.default ?? ent?.import ?? ent?.default);
		if (!rel) return null;
		const url = pathToFileURL(path.join(path.dirname(pkgPath), rel)).href;
		mod = await import(url);
	} catch {
		return null;
	}
	if (typeof mod.tanstackStart !== "function") return null;
	const flat = ([] as unknown[]).concat(mod.tanstackStart()).flat(Infinity);
	const plugin = flat.find(
		(p): p is Plugin =>
			!!p &&
			typeof p === "object" &&
			(p as Plugin).name === "tanstack-start-core::server-fn:client",
	);
	if (!plugin) return null;
	// Run in our single standalone env whatever Vite calls it.
	return { ...plugin, applyToEnvironment: () => true };
}

// Start's server-fn compiler derives the function-id scheme from
// `this.environment.mode`: 'build' → sha256 hash, otherwise → a base64 dev id.
// A Vite `build()` is ALWAYS mode 'build', so in dev the worker would emit hashed
// ids while the dev server registers server fns under dev (base64) ids — the
// worker's in-render RPC then 500s with "Invalid server function ID". This wraps
// the compiler plugin's hooks so they see `environment.mode === 'dev'`, making
// the worker emit dev ids that match the dev server. Build (prod) is left alone:
// there, both worker and server are mode 'build', so the hashes already match.
//
// NOTE: a Proxy over Start's internal PluginContext.environment — coupled to
// Start internals, so it's guarded by the plugin-name lookup above and only
// applied in dev.
/** @internal exported for tests; not part of the public API. */
export function withForcedDevMode(plugin: Plugin): Plugin {
	type Ctx = Record<string | symbol, unknown> & { environment?: object };
	const devEnv = (env: object) =>
		new Proxy(env, {
			get: (t, p) =>
				p === "mode" ? "dev" : (t as Record<string | symbol, unknown>)[p],
		});
	const wrapCtx = (ctx: Ctx) =>
		new Proxy(ctx, {
			get(t, p) {
				if (p === "environment" && t.environment) return devEnv(t.environment);
				const v = t[p];
				return typeof v === "function" ? v.bind(t) : v;
			},
		});
	// biome-ignore lint/suspicious/noExplicitAny: dynamic hook shapes
	const wrap = (hook: any): any => {
		if (typeof hook === "function") {
			return function (this: Ctx, ...args: unknown[]) {
				return hook.apply(wrapCtx(this), args);
			};
		}
		if (hook && typeof hook.handler === "function") {
			const h = hook.handler;
			return {
				...hook,
				handler(this: Ctx, ...args: unknown[]) {
					return h.apply(wrapCtx(this), args);
				},
			};
		}
		return hook;
	};
	return {
		...plugin,
		buildStart: wrap(plugin.buildStart),
		transform: wrap(plugin.transform),
		watchChange: wrap(plugin.watchChange),
	};
}

// Bundles the worker to a single self-contained ESM file via Vite's build().
/** @internal exported for tests; not part of the public API. */
export async function bundleWorker(
	options: TanstackWsrOptions,
	dev: boolean,
	resolveUrl: (absPath: string) => string,
	clientEntry: string,
): Promise<string> {
	const input = options.entry ? path.resolve(options.entry) : WSR_VIRTUAL_ENTRY;
	let serverFnPlugin = await getServerFnClientPlugin();
	// In dev, force dev-mode function ids so the worker's RPCs match the dev
	// server's registered ids. Prod build ids already match (both 'build').
	if (serverFnPlugin && dev) serverFnPlugin = withForcedDevMode(serverFnPlugin);
	const result = await build({
		// Don't reload the app's vite config — that would recursively include this
		// plugin and loop. This build is standalone but reuses Vite's resolver.
		configFile: false,
		logLevel: "silent",
		clearScreen: false,
		define: {
			"process.env.NODE_ENV": dev ? '"development"' : '"production"',
			// createClientRpc reads this at init to build server-fn request URLs.
			"process.env.TSS_SERVER_FN_BASE": JSON.stringify(DEFAULT_SERVER_FN_BASE),
			// Start's client hydration entry the worker's manifest points <Scripts/> at.
			__WSR_CLIENT_ENTRY__: JSON.stringify(clientEntry),
		},
		// Same export conditions as the app's Cloudflare/SSR build → isServer=true,
		// react-dom/server -> the edge/Web-Streams build.
		resolve: {
			conditions: ["workerd", "module", "browser", "import", "default"],
			// Keep the Solid-based devtools (and their solid-js dep) out of /sw.js.
			alias: [DEVTOOLS_ALIAS],
		},
		// Automatic JSX runtime (the worker tree is .tsx); no react-refresh because
		// build() runs in build mode, not dev-server mode.
		esbuild: { jsx: "automatic", jsxImportSource: "react" },
		plugins: [
			// Either Start's client server-fn compiler (enforce:'pre' — rewrites
			// createServerFn → createClientRpc and strips server-only bodies, giving
			// browser parity), OR, if it couldn't be loaded, the fallback guard that
			// fails the build rather than letting raw server code leak into /sw.js.
			serverFnPlugin ??
				serverCodeGuard(path.resolve(process.cwd(), "src") + path.sep),
			urlAssetPlugin(resolveUrl),
			swEntryPlugin(options),
			nodeStreamStub(),
		],
		build: {
			write: false,
			minify: !dev,
			target: "esnext",
			sourcemap: dev ? "inline" : false,
			rollupOptions: {
				input,
				// One self-contained file (no code-splitting / vendor chunks).
				output: { format: "es", inlineDynamicImports: true },
			},
		},
	});

	const output = Array.isArray(result) ? result[0] : result;
	if (!("output" in output)) {
		throw new Error("tanstack-wsr: unexpected build() result (watch mode?)");
	}
	const chunk = output.output.find((o) => o.type === "chunk");
	if (!chunk) throw new Error("tanstack-wsr: no chunk produced for the worker");
	return chunk.code;
}

/**
 * Vite plugin that renders selected TanStack Start routes inside a service
 * worker (SW). Mark routes with `wsr: true`; the plugin bundles a worker to
 * `/sw.js` that renders those routes in-worker on document loads.
 */
export function tanstackWsr(options: TanstackWsrOptions = {}): Plugin {
	return {
		name: "tanstack-sw",

		// Dev: serve a freshly bundled worker on every request, so editing the
		// source is reflected on reload — no stale build artifact.
		configureServer(server) {
			// Dev: assets resolve to their Vite source URL (e.g. /src/styles.css).
			const root = process.cwd();
			const devUrl = (abs: string) =>
				`/${path.relative(root, abs).split(path.sep).join("/")}`;

			server.middlewares.use(async (req, res, next) => {
				if ((req.url?.split("?")[0] ?? "") !== SW_URL) return next();
				try {
					const code = await bundleWorker(
						options,
						true,
						devUrl,
						DEV_CLIENT_ENTRY,
					);
					res.setHeader("Content-Type", "text/javascript");
					res.setHeader("Cache-Control", "no-cache");
					res.end(code);
				} catch (err) {
					next(err);
				}
			});

			// The worker bundle is built from the whole app tree but lives outside
			// Vite's module graph, so Vite never reloads it. Watch src/ and ping the
			// client to pull a fresh worker on save — this is what makes worker-side
			// edits (e.g. flipping a route's `sw` flag, or a loader that runs in the
			// worker) take effect without a manual refresh.
			const srcRoot = path.resolve("src");
			server.watcher.on("change", (file) => {
				if (file.startsWith(srcRoot)) {
					server.ws.send({ type: "custom", event: "wsr:update" });
				}
			});
		},

		// Build: emit dist/sw.js into the client output only — skip the SSR pass.
		async generateBundle(_options, bundle) {
			if (this.environment && this.environment.name !== "client") return;

			// The client build hashes the CSS; SW-rendered pages must link the same
			// emitted asset. Find it in this build's output and map styles.css?url to
			// it; other assets fall back to a root-relative source path.
			const cssAsset = Object.values(bundle).find(
				(o) => o.type === "asset" && o.fileName.endsWith(".css"),
			);
			const root = process.cwd();
			const buildUrl = (abs: string) =>
				abs.endsWith(".css") && cssAsset
					? `/${cssAsset.fileName}`
					: `/${path.relative(root, abs).split(path.sep).join("/")}`;

			// Start's client hydration entry is the sole entry chunk; the worker points
			// <Scripts/> at it so Start's bundle hydrates SW-rendered pages.
			const entryChunk = Object.values(bundle).find(
				(o) => o.type === "chunk" && o.isEntry,
			);
			if (!entryChunk) {
				this.error("tanstack-wsr: could not find the client entry chunk");
			}
			const clientEntry = `/${entryChunk.fileName}`;

			this.emitFile({
				type: "asset",
				fileName: SW_URL.slice(1),
				source: await bundleWorker(options, false, buildUrl, clientEntry),
			});
		},
	};
}
