import {
	createRootRoute,
	createRoute,
	createRouter,
	type RouterHistory,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	dispatchWorkerRoute,
	isWorkerRouteRequest,
	workerFetch,
} from "../../src/worker-fetch";

const ORIGIN = "https://app.test";

// A router with a single worker route at /api/echo.
function routerWith(
	handlers: Record<
		string,
		(ctx: { request: Request }) => Response | Promise<Response>
	>,
) {
	const rootRoute = createRootRoute();
	const apiRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/api/echo",
		// @ts-expect-error — the `worker` option augmentation isn't visible in this
		// standalone test program, but it's a plain passthrough option at runtime.
		worker: { handlers },
	});
	const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
	const routeTree = rootRoute.addChildren([apiRoute, indexRoute]);
	return (history?: RouterHistory) =>
		createRouter({ routeTree, history }) as never;
}

describe("isWorkerRouteRequest", () => {
	it("true for non-GET (mutations)", () => {
		expect(
			isWorkerRouteRequest(new Request(`${ORIGIN}/api/x`, { method: "POST" })),
		).toBe(true);
	});
	it("true for a GET asking for JSON", () => {
		expect(
			isWorkerRouteRequest(
				new Request(`${ORIGIN}/api/x`, { headers: { accept: "application/json" } }),
			),
		).toBe(true);
	});
	it("false for a document GET", () => {
		expect(
			isWorkerRouteRequest(
				new Request(`${ORIGIN}/x`, { headers: { accept: "text/html" } }),
			),
		).toBe(false);
	});
	it("false for an asset GET", () => {
		expect(
			isWorkerRouteRequest(
				new Request(`${ORIGIN}/app.js`, { headers: { accept: "*/*" } }),
			),
		).toBe(false);
	});
});

describe("dispatchWorkerRoute", () => {
	it("runs the matched route's handler for the method", async () => {
		const getRouter = routerWith({
			POST: async ({ request }) => Response.json({ got: await request.json() }),
		});
		const res = await dispatchWorkerRoute(
			getRouter,
			new Request(`${ORIGIN}/api/echo`, {
				method: "POST",
				body: JSON.stringify({ a: 1 }),
				headers: { "content-type": "application/json" },
			}),
		);
		expect(res?.status).toBe(200);
		expect(await res?.json()).toEqual({ got: { a: 1 } });
	});

	it("undefined when the route has no handler for the method", async () => {
		const getRouter = routerWith({ POST: async () => new Response("ok") });
		const res = await dispatchWorkerRoute(
			getRouter,
			new Request(`${ORIGIN}/api/echo`, {
				headers: { accept: "application/json" },
			}),
		);
		expect(res).toBeUndefined();
	});

	it("undefined when no route matches the path", async () => {
		const getRouter = routerWith({ GET: async () => new Response("ok") });
		const res = await dispatchWorkerRoute(
			getRouter,
			new Request(`${ORIGIN}/nope`, { headers: { accept: "application/json" } }),
		);
		expect(res).toBeUndefined();
	});
});

describe("workerFetch", () => {
	afterEach(() => {
		delete (globalThis as { __WSR_IN_WORKER__?: boolean }).__WSR_IN_WORKER__;
		delete (globalThis as { __WSR_GET_ROUTER__?: unknown }).__WSR_GET_ROUTER__;
		vi.unstubAllGlobals();
	});

	it("dispatches directly when in the worker", async () => {
		(globalThis as { __WSR_IN_WORKER__?: boolean }).__WSR_IN_WORKER__ = true;
		(globalThis as { __WSR_GET_ROUTER__?: unknown }).__WSR_GET_ROUTER__ =
			routerWith({ GET: async () => Response.json({ ok: true }) });
		const res = await workerFetch("/api/echo");
		expect(await res.json()).toEqual({ ok: true });
	});

	it("returns 503 on the server (no worker)", async () => {
		const res = await workerFetch("/api/echo");
		expect(res.status).toBe(503);
	});

	it("fetches on the main thread, marking GET as JSON", async () => {
		vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
		const calls: Array<{ input: string; init?: RequestInit }> = [];
		vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
			calls.push({ input, init });
			return new Response("x");
		});
		await workerFetch("/api/echo");
		expect(calls[0].input).toBe("/api/echo");
		expect(new Headers(calls[0].init?.headers).get("accept")).toBe(
			"application/json",
		);
	});
});
