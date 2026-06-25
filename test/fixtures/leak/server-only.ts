import { createServerOnlyFn } from "@tanstack/react-start";
import { SERVER_ONLY_SECRET } from "./secrets";

// The client compiler should replace this body with a throw stub; the body
// (and SERVER_ONLY_SECRET) must never reach the worker bundle.
export const probeServerOnly = createServerOnlyFn(() => SERVER_ONLY_SECRET);
