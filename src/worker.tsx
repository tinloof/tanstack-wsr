import {
	type AnyRouter,
	createMemoryHistory,
	type RouterHistory,
	RouterProvider,
} from "@tanstack/react-router";
import { renderRouterToString } from "@tanstack/react-router/ssr/server";
import { attachRouterServerSsrUtils } from "@tanstack/router-core/ssr/server";
import "./types";

// Start's client runtime resolves options via `window.__TSS_START_OPTIONS__`
// (server functions get compiled to client-side RPCs in the worker bundle). A
// service worker has no `window`, so alias it to globalThis — the lookup then
// returns undefined instead of throwing when a server fn is invoked in-worker.
(globalThis as { window?: unknown }).window ??= globalThis;

// Injected into the worker bundle by the Vite plugin: TanStack Start's client
// hydration entry. SW-rendered pages point <Scripts/> at it so Start's own
// client bundle hydrates them (same route tree as the main app).
declare const __WSR_CLIENT_ENTRY__: string;

// Minimal service-worker global surface. We access it via globalThis (not the
// ambient `self`) and avoid the "webworker" TS lib so this file also type-checks
// in apps whose tsconfig targets the DOM.
interface SwExtendableEvent {
	waitUntil(promise: Promise<unknown>): void;
}
interface SwFetchEvent {
	readonly request: Request;
	respondWith(response: Response | Promise<Response>): void;
}
interface ServiceWorkerGlobal {
	addEventListener(type: "install", listener: () => void): void;
	addEventListener(
		type: "activate",
		listener: (event: SwExtendableEvent) => void,
	): void;
	addEventListener(
		type: "fetch",
		listener: (event: SwFetchEvent) => void,
	): void;
	skipWaiting(): Promise<void>;
	readonly clients: { claim(): Promise<void> };
	readonly location: { origin: string };
}

export interface CreateWsrWorkerOptions {
	/**
	 * The app's router factory. Called with a memory history seeded to the
	 * request URL for each intercepted navigation. Usually the same `getRouter`
	 * the main app registers — sharing it keeps render and hydration in sync.
	 */
	getRouter: (history?: RouterHistory) => AnyRouter;
}

/**
 * Wires up a service worker that service-worker-side renders (SW) document
 * navigations for routes marked `wsr: true`, in-worker, and lets everything
 * else fall through to the origin. Call this from your worker entry (the file
 * the plugin bundles to `/sw.js`):
 *
 * ```ts
 * import { createWsrWorker } from '@tinloof/tanstack-wsr/worker'
 * import { getRouter } from './router'
 * createWsrWorker({ getRouter })
 * ```
 */
export function createWsrWorker({ getRouter }: CreateWsrWorkerOptions) {
	const sw = globalThis as unknown as ServiceWorkerGlobal;

	// Activate immediately so a freshly installed worker takes control without a
	// manual reload (key for the dev update flow; harmless in production).
	sw.addEventListener("install", () => void sw.skipWaiting());
	sw.addEventListener("activate", (event) =>
		event.waitUntil(sw.clients.claim()),
	);

	sw.addEventListener("fetch", (event) => {
		const request = event.request;
		const url = new URL(request.url);
		if (!isNavigationRequest(request, url, sw.location.origin)) return;
		event.respondWith(renderRequest(url, request, getRouter));
	});
}

/**
 * Whether the worker should consider intercepting a request: only same-origin
 * top-level document navigations (GET + an HTML `accept`). Assets (JS/CSS/img)
 * and cross-origin requests pass straight through to the network.
 *
 * @internal exported for tests.
 */
export function isNavigationRequest(
	request: Request,
	url: URL,
	swOrigin: string,
): boolean {
	return (
		request.method === "GET" &&
		(request.headers.get("accept") ?? "").includes("text/html") &&
		url.origin === swOrigin
	);
}

/**
 * Whether a matched route chain should be rendered in the worker: true if ANY
 * route in it (leaf, parent, pathless/layout, or root) is marked `wsr`. The
 * chain renders as one document, so `wsr` inherits down the tree.
 *
 * @internal exported for tests.
 */
export function isWsrChain(
	matchedRoutes: ReadonlyArray<{ options?: { wsr?: boolean } }>,
): boolean {
	return matchedRoutes.some((route) => route.options?.wsr === true);
}

async function renderRequest(
	url: URL,
	request: Request,
	getRouter: CreateWsrWorkerOptions["getRouter"],
): Promise<Response> {
	const router = getRouter(
		createMemoryHistory({ initialEntries: [url.pathname + url.search] }),
	);

	// Decide WITHOUT running loaders: pure path matching. The gate is
	// CHAIN-AWARE — if ANY route in the matched chain (the leaf, a parent, a
	// pathless/layout route, or the root) is marked `wsr`, render the whole
	// document in-worker. A document load renders the entire root→leaf chain in
	// one environment, so `wsr` naturally inherits down the tree: mark a layout
	// to opt a section in, or the root to opt the whole app in. Everything else
	// (including unmatched/404, unless the root is marked) falls through to the
	// origin untouched — so a non-wsr route's loaders never run here.
	const { matchedRoutes } = router.getMatchedRoutes(url.pathname);
	if (!isWsrChain(matchedRoutes)) {
		return fetch(request);
	}

	// Marked route — run its loaders and render. The minimal manifest points
	// <Scripts/> at Start's client entry so its bundle hydrates this page.
	await router.load();
	attachRouterServerSsrUtils({
		router,
		manifest: {
			routes: {
				__root__: {
					scripts: [
						{
							attrs: { type: "module", async: true, src: __WSR_CLIENT_ENTRY__ },
						},
					],
				},
			},
		},
	});
	await router.serverSsr?.dehydrate();

	return renderRouterToString({
		router,
		responseHeaders: new Headers({ "content-type": "text/html" }),
		children: <RouterProvider router={router} />,
	});
}
