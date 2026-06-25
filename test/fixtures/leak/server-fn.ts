import { createServerFn } from "@tanstack/react-start";
import { SERVER_FN_SECRET } from "./secrets";

// The client compiler should rewrite this to createClientRpc(id); the body
// (and SERVER_FN_SECRET) must never reach the worker bundle.
export const probeServerFn = createServerFn({ method: "GET" }).handler(
	async () => SERVER_FN_SECRET,
);
