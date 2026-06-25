import {
	createRouter as createTanStackRouter,
	type RouterHistory,
} from "@tanstack/react-router";
import { NotFound } from "./components/not-found";
import { routeTree } from "./routeTree.gen";

// Single router factory for the whole app. The main thread / Cloudflare call it
// with no args; the service worker passes a memory history seeded to the request
// URL (a worker has no browser history). Sharing one factory keeps the router
// options identical between the SW render and the client that hydrates it.
export function getRouter(history?: RouterHistory) {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Optional — standard TanStack Router not-found UI (here for unknown recipe
		// ids, which throw notFound()). Not required by wsr: without it the router
		// falls back to its built-in "Not Found", same as any Start app.
		defaultNotFoundComponent: NotFound,
		...(history ? { history } : {}),
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

// The `sw` route-option augmentation lives in @tinloof/tanstack-wsr
// (pulled in via the <WsrRegister> import in __root.tsx).
