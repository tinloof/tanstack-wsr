// Augments TanStack Router with first-class `wsr` and `worker` route options.
// Imported (for its types) by both ./worker and ./react, so an app picks them up
// whether it imports the worker helper or the <WsrRegister> component.
//
// `UpdatableRouteOptionsExtensions` is TanStack's sanctioned empty-interface
// hook for adding top-level route options (the same pattern `StaticDataRouteOption`
// uses for `staticData`). So `createFileRoute('/x')({ wsr: true })` type-checks,
// and the value is kept on `route.options.wsr` at runtime.
import type {} from "@tanstack/router-core";

/** HTTP methods a worker route can handle. */
export type WorkerRouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A worker route handler — the service-worker mirror of a server-route handler.
 * Runs in the service worker (where a single stateful client can live) and
 * returns a `Response`, just like `server.handlers`.
 */
export type WorkerRouteHandler = (ctx: {
	request: Request;
}) => Response | Promise<Response>;

declare module "@tanstack/router-core" {
	interface UpdatableRouteOptionsExtensions {
		/**
		 * Service-Worker-Side Render this route: on a document (hard) load the
		 * service worker renders it in-worker; on SPA navigation the client router
		 * renders it. The loader runs in whichever environment handled the request.
		 *
		 * Inherits down the route tree: marking a route opts it AND all of its
		 * descendants in (a document renders the whole matched chain in one
		 * environment), so you can mark a layout/parent to opt a whole section in,
		 * or the root route to opt the entire app in. Every ancestor's loader and
		 * `beforeLoad` then run in-worker too, so they must be worker-safe
		 * (`createServerFn` is fine — it becomes a network RPC).
		 *
		 * Must be set on an EAGER route definition (`createFileRoute` /
		 * `createRoute` / `createRootRoute`). It is not supported in `.lazy` files
		 * (`createLazyFileRoute`/`createLazyRoute`): the gate reads the flag before
		 * the lazy chunk loads, so it would be invisible.
		 */
		wsr?: boolean;

		/**
		 * Request handlers that run in the SERVICE WORKER — the mirror of `server`
		 * route handlers, addressed by the route's own path. Reach them with
		 * `workerFetch(path, init)`: it runs the handler directly when already in
		 * the worker (e.g. a wsr loader on a hard load) and `fetch`es the path from
		 * the main thread (the worker intercepts it). Lets a single stateful client
		 * (a local-first / sync-engine client) live in the worker so reads and
		 * writes share one store. Pair with `server.handlers` for the same method to
		 * get an origin fallback when no worker is in control yet.
		 */
		worker?: {
			handlers?: Partial<Record<WorkerRouteMethod, WorkerRouteHandler>>;
		};
	}
}

/**
 * Type of the `wsr` route option. Re-exported from `@tinloof/tanstack-wsr/react`
 * so the module augmentation above lands in the generated `.d.ts`: a named
 * export forces tsdown's dts bundler to keep this module (and its
 * `declare module`), which a bare side-effect import does not.
 */
export type WsrRouteOption = boolean;
