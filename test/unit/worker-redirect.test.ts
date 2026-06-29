import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
	type RouterHistory,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { renderRequest } from "../../src/worker";

// A redirect thrown in a route's beforeLoad must become a real redirect Response
// from the worker — otherwise the SW renders the original route and the redirect
// (e.g. an auth gate → /login) is silently lost.

function getRouterFactory(redirectTo?: string) {
	const rootRoute = createRootRoute({ wsr: true });
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		beforeLoad: () => {
			if (redirectTo) throw redirect({ to: redirectTo });
		},
		component: () => null,
	});
	const routeTree = rootRoute.addChildren([indexRoute]);
	return (history?: RouterHistory) =>
		createRouter({ routeTree, history }) as never;
}

function navRequest(url: string) {
	return new Request(url, { headers: { accept: "text/html" } });
}

describe("renderRequest redirect handling", () => {
	it("turns a beforeLoad redirect into a redirect Response", async () => {
		const url = new URL("https://app.test/");
		const res = await renderRequest(
			url,
			navRequest(url.href),
			getRouterFactory("/login"),
		);
		expect(res.status).toBe(307);
		expect(res.headers.get("Location")).toBe("/login");
	});

	it("does not redirect when beforeLoad does not throw", async () => {
		const url = new URL("https://app.test/");
		// Pre-resolve the matched router to confirm no redirect is recorded; the
		// full HTML render is covered by the e2e suite.
		const router = getRouterFactory()(
			createMemoryHistory({ initialEntries: ["/"] }),
		);
		await router.load();
		expect(router.state.redirect).toBeUndefined();
	});
});
