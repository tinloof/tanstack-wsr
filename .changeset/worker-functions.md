---
"@tinloof/tanstack-wsr": minor
---

Add **worker routes** — the mirror of TanStack server routes, but the handlers run in the service worker. Declare them with the `worker` route option (`createFileRoute("/api/todos")({ worker: { handlers: { GET, POST, … } } })`); the route's path is the identity (no name, no codegen — the router is the dispatch table). This lets a single stateful client (a local-first / sync-engine client) live in the worker so reads and writes share one store, and a hard-load render reflects exactly what the user just did. Call them with `workerFetch(path, init)` — runs the handler directly in the worker (e.g. a wsr loader), `fetch`es the path on the main thread (the worker intercepts it), and returns a `503` on the origin server so callers can fall back. `broadcastToClients(message)` pushes invalidations to pages.

Also fixes two worker issues surfaced building on top of WSR:

- **Honor thrown redirects.** A `redirect()` thrown in `beforeLoad`/`loader` was captured on router state but never acted on, so the worker rendered the original route instead of redirecting (e.g. an auth gate to `/login`). It now returns a real redirect `Response`.
- **Keep the dev worker under the service-worker script-size limit.** The inline sourcemap roughly doubled the bundle and could push it past Chromium's ~6 MB SW limit (registration failing with "Failed to access storage"); the worker bundle no longer inlines a sourcemap, and resolves a single React/router copy to avoid duplicate-instance SSR hook errors.
