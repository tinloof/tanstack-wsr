// Augments TanStack Router with a first-class `sw` route option. Imported (for
// its types) by both ./worker and ./react, so an app picks it up whether it
// imports the worker helper or the <WsrRegister> component.
//
// `UpdatableRouteOptionsExtensions` is TanStack's sanctioned empty-interface
// hook for adding top-level route options (the same pattern `StaticDataRouteOption`
// uses for `staticData`). So `createFileRoute('/x')({ wsr: true })` type-checks,
// and the value is kept on `route.options.wsr` at runtime.
import type {} from "@tanstack/router-core";

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
	}
}

/**
 * Type of the `wsr` route option. Re-exported from `@tinloof/tanstack-wsr/react`
 * so the module augmentation above lands in the generated `.d.ts`: a named
 * export forces tsdown's dts bundler to keep this module (and its
 * `declare module`), which a bare side-effect import does not.
 */
export type WsrRouteOption = boolean;
