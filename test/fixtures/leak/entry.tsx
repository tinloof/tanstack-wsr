import { ProbeComponent } from "./component";
import { probeServerFn } from "./server-fn";
import { probeServerOnly } from "./server-only";
import cssUrl from "./style.css?url";

// Sink everything so nothing is tree-shaken before the compiler has transformed
// it — the leak test needs the server-fn/server-only call sites in the graph.
(globalThis as Record<string, unknown>).__wsrLeakProbe__ = {
	probeServerFn,
	probeServerOnly,
	ProbeComponent,
	cssUrl,
};
