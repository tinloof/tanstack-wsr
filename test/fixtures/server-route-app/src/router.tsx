import {
	type RouterHistory,
	createRouter as createTanStackRouter,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter(history?: RouterHistory) {
	return createTanStackRouter({
		routeTree,
		...(history ? { history } : {}),
	});
}
