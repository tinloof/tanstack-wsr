import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// A server fn called from a wsr route loader — the case withForcedDevMode used
// to make work in dev (matching function ids).
const greet = createServerFn({ method: "GET" }).handler(async () => "hello");

export const Route = createFileRoute("/")({
	loader: () => greet(),
	component: () => <div>CLIENT_INDEX_VISIBLE_marker</div>,
});
