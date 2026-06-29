// Worker routes — the mirror of TanStack server routes, but handlers run in the
// SERVICE WORKER. Declare them with the `worker` route option (see types.ts):
//
//   createFileRoute("/api/todos")({
//     worker: { handlers: { GET: async () => Response.json(await read()) } },
//   })
//
// Reach them with `workerFetch(path, init)`. The route's PATH is the identity —
// no name, no build-time transform — and the router is the dispatch table. A
// single stateful client (a local-first / sync-engine client) can live in the
// worker so reads and writes share one store; a hard-load render reads back the
// same client.

import type { AnyRouter, RouterHistory } from "@tanstack/react-router";
import { createMemoryHistory } from "@tanstack/react-router";
import type { WorkerRouteHandler } from "./types";

export type { WorkerRouteHandler, WorkerRouteMethod } from "./types";

type GetRouter = (history?: RouterHistory) => AnyRouter;

function inWorker(): boolean {
	return (
		(globalThis as { __WSR_IN_WORKER__?: boolean }).__WSR_IN_WORKER__ === true
	);
}

/**
 * SW-side: match the request path against the route tree and run the matched
 * route's `worker` handler for the method. Returns the handler's Response, or
 * `undefined` if no worker handler matches (the caller then falls back to the
 * network). Leaf-first, so the most specific route wins.
 */
export async function dispatchWorkerRoute(
	getRouter: GetRouter,
	request: Request,
): Promise<Response | undefined> {
	const url = new URL(request.url);
	const router = getRouter(
		createMemoryHistory({ initialEntries: [url.pathname + url.search] }),
	);
	const { matchedRoutes } = router.getMatchedRoutes(url.pathname);
	for (let i = matchedRoutes.length - 1; i >= 0; i--) {
		const handlers = (
			matchedRoutes[i].options as {
				worker?: { handlers?: Record<string, WorkerRouteHandler> };
			}
		)?.worker?.handlers;
		const handler = handlers?.[request.method];
		if (handler) return handler({ request });
	}
	return undefined;
}

/**
 * Whether the worker should try worker-route dispatch for a request before the
 * navigation gate. Non-GET (mutations) always qualify; GET only when it asks for
 * JSON — so document navigations (`Accept: text/html`) and assets are skipped.
 *
 * @internal exported for tests.
 */
export function isWorkerRouteRequest(request: Request): boolean {
	if (request.method !== "GET") return true;
	return (request.headers.get("accept") ?? "").includes("application/json");
}

/**
 * Call a worker route, resolving in the right place:
 * - in the worker (e.g. a wsr loader on a hard load) → runs the handler directly;
 * - on the main thread → `fetch`es the path, which the worker intercepts;
 * - on the origin server (no worker) → a 503, so callers can fall back (e.g.
 *   render an empty shell until the worker takes over).
 *
 * Returns a `Response`, like `fetch`.
 */
export async function workerFetch(
	input: string,
	init?: RequestInit,
): Promise<Response> {
	if (inWorker()) {
		const getRouter = (globalThis as { __WSR_GET_ROUTER__?: GetRouter })
			.__WSR_GET_ROUTER__;
		if (!getRouter) return new Response(null, { status: 503 });
		// Base only matters to build a URL; route matching uses the path.
		const request = new Request(new URL(input, "http://wsr.local"), init);
		const res = await dispatchWorkerRoute(getRouter, request);
		return res ?? new Response(null, { status: 404 });
	}
	if (typeof navigator !== "undefined" && navigator.serviceWorker) {
		const headers = new Headers(init?.headers);
		const method = (init?.method ?? "GET").toUpperCase();
		// Mark GETs as data so the worker treats them as a worker route, not a
		// document navigation or an asset (see isWorkerRouteRequest).
		if (method === "GET" && !headers.has("accept")) {
			headers.set("accept", "application/json");
		}
		return fetch(input, { ...init, headers });
	}
	return new Response(null, { status: 503 });
}

/** SW-side: post a message to every page (e.g. to trigger router.invalidate()). */
export async function broadcastToClients(message: unknown): Promise<void> {
	const sw = globalThis as unknown as {
		clients?: {
			matchAll(opts?: {
				includeUncontrolled?: boolean;
				type?: string;
			}): Promise<Array<{ postMessage(m: unknown): void }>>;
		};
	};
	const list =
		(await sw.clients?.matchAll({
			includeUncontrolled: true,
			type: "window",
		})) ?? [];
	for (const c of list) c.postMessage(message);
}
