import { createFileRoute } from "@tanstack/react-router";
import { SERVER_ROUTE_SECRET } from "../../secret-value";

// A PURE server route (only a `server` handler, no component). It and its
// server-only import must be pruned from the worker bundle, exactly as Start
// prunes it from the app's own client build.
export const Route = createFileRoute("/api/secret")({
	server: {
		handlers: {
			GET: () => new Response(SERVER_ROUTE_SECRET),
		},
	},
});
