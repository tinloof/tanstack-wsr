# @tinloof/tanstack-wsr

## 0.2.0

### Minor Changes

- 3e8d18b: Add **worker routes** — the mirror of TanStack server routes, but the handlers run in the service worker. Declare them with the `worker` route option (`createFileRoute("/api/todos")({ worker: { handlers: { GET, POST, … } } })`); the route's path is the identity (no name, no codegen — the router is the dispatch table). This lets a single stateful client (a local-first / sync-engine client) live in the worker so reads and writes share one store, and a hard-load render reflects exactly what the user just did. Call them with `workerFetch(path, init)` — runs the handler directly in the worker (e.g. a wsr loader), `fetch`es the path on the main thread (the worker intercepts it), and returns a `503` on the origin server so callers can fall back. `broadcastToClients(message)` pushes invalidations to pages.

  Also fixes two worker issues surfaced building on top of WSR:

  - **Honor thrown redirects.** A `redirect()` thrown in `beforeLoad`/`loader` was captured on router state but never acted on, so the worker rendered the original route instead of redirecting (e.g. an auth gate to `/login`). It now returns a real redirect `Response`.
  - **Keep the dev worker under the service-worker script-size limit.** The inline sourcemap roughly doubled the bundle and could push it past Chromium's ~6 MB SW limit (registration failing with "Failed to access storage"); the worker bundle no longer inlines a sourcemap, and resolves a single React/router copy to avoid duplicate-instance SSR hook errors.

## 0.1.2

### Patch Changes

- 1a9a9ba: Fix `/sw.js` build failing for apps with server routes or server-only imports.

  The worker bundle now reproduces TanStack Start's full **client** transform, not
  just the server-fn compiler. Pure-server routes (a `createFileRoute` with only a
  `server` handler) and their server-only dependencies (DB clients, auth libraries,
  etc.) are pruned from the worker graph exactly as in the app's own client build,
  so they never reach `/sw.js`.

  Previously the worker pulled those handlers in and the build crashed with
  `environment.transformRequest is not a function`. Root cause: the server-fn
  compiler was forced into dev mode (for dev-matching function ids) inside a
  `build()` that has no `transformRequest`, and its dev module loader then choked
  on cross-module server imports (e.g. an auth lib).

  Now route pruning removes those server-only modules from the graph first, so dev
  mode is safe again — the dev-mode forcing is kept (scoped to the server-fn
  compiler, dev only) so that **server functions called during the in-worker render
  still get dev-matching ids and work in dev**. Production is unchanged (both worker
  and origin use build-mode sha256 ids). Route pruning applies to the default
  router-derived entry; a custom `entry` (advanced) still gets server-fn
  compilation alone.

## 0.1.1

### Patch Changes

- c7424f6: Update docs
