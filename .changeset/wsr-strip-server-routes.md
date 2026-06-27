---
"@tinloof/tanstack-wsr": patch
---

Fix `/sw.js` build failing for apps with server routes or server-only imports.

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
