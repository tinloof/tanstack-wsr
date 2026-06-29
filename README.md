# @tinloof/tanstack-wsr

Render TanStack Start routes inside a service worker with just one route flag:

```ts
export const Route = createFileRoute("/dashboard")({
  wsr: true, // ← rendered on-device by the service worker
  loader: () => readLocalData(),
  component: Dashboard,
});
```

## Example

[`examples/recipes`](./examples/recipes) — a local-first recipes app

<video src="https://github.com/user-attachments/assets/eb207b28-93c8-4865-adef-9bc009b9c94f" controls muted playsinline width="100%">
  Your browser can't play embedded video —
  <a href="https://github.com/user-attachments/assets/eb207b28-93c8-4865-adef-9bc009b9c94f">play it directly</a>.
</video>

_[Demo link](https://tanstack-start-sw-recipes.tinloof.workers.dev/)_

## Install

```sh
npm i @tinloof/tanstack-wsr
```

## Setup

**1 — Add the vite plugin** (generates `/sw.js` from your `getRouter`; no worker file
to write):

```ts
// vite.config.ts
import { tanstackWsr } from "@tinloof/tanstack-wsr/vite";

export default defineConfig({
  plugins: [tanstackWsr(), tanstackStart()],
});
```

**2 — Register the generated service worker** once in your root document:

```tsx
// src/routes/__root.tsx
import { WsrRegister } from "@tinloof/tanstack-wsr/react";

// inside <body>
<WsrRegister hot={import.meta.hot} />;
```

**3 — Let `getRouter` take a history** (the worker seeds one per request):

```ts
export function getRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) });
}
```

Then flag any route with `wsr: true`. Done.

## Marking routes

`wsr` is a normal route option, so it works on **any eager route API** — file-based
or code-based, including the root:

```ts
// code-based child route
const dashboard = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/dashboard",
  wsr: true,
});

// the root route — opts the whole app in
const rootRoute = createRootRoute({ wsr: true });
```

Use an **eager** definition — `wsr` is ignored in `.lazy` files
(`createLazyFileRoute`/`createLazyRoute`), since the gate reads it before the
lazy chunk loads.

## Nested routes

A document load renders its **whole matched chain** (root → layouts → leaf) in
one environment, so `wsr` **inherits down the tree**: marking a route opts in
that route and everything under it. Given this tree:

```
root
├─ /                    (index)
├─ /posts               (parent / layout)
│  ├─ /posts/           (index)
│  └─ /posts/$id
└─ /settings            (layout)
   └─ /settings/profile
```

each `wsr: true` placement opts in these pages (✓ = rendered in the worker,
– = served by the origin):

| `wsr: true` on…      | `/` | `/posts` | `/posts/$id` | `/settings/profile` |
| -------------------- | :-: | :------: | :----------: | :-----------------: |
| `root`               |  ✓  |    ✓     |      ✓       |          ✓          |
| `/posts` (parent)    |  –  |    ✓     |      ✓       |          –          |
| `/posts/` (index)    |  –  |    ✓     |      –       |          –          |
| `/posts/$id`         |  –  |    –     |      ✓       |          –          |
| `/settings` (layout) |  –  |    –     |      –       |          ✓          |

Note the `/posts/` index row: it's a leaf _sibling_ of `/posts/$id`, so marking
it opts in only the `/posts` page, not the detail pages — mark the **index** (not
the **parent**) to scope `wsr` to just that page. Inheritance has **no opt-out**:
once a parent or the root is marked, you can't exclude a descendant — mark the
specific routes you want instead.

Two consequences:

- **Ancestors run in the worker.** When a chain is worker-rendered, every
  ancestor's `loader` and `beforeLoad` runs there — keep them worker-safe
  (`createServerFn` is fine, it becomes an RPC).
- **404s follow the root.** Unmatched paths render in the worker only if the
  **root** is marked; otherwise they fall through to the origin.

## Worker routes

The mirror of TanStack [server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes),
but the handlers run in the **service worker**. Declare them with the `worker`
route option — the route's **path is the identity** (no name, no codegen; the
router is the dispatch table). This lets a single stateful client — a local-first
/ sync-engine client (Zero, Replicache, …) — live in the worker, with **reads and
writes both going through it**. Because a wsr render reads that same client, a
hard-load render reflects exactly what the user just did: one client, one store,
no cross-client round-trip, no stale flash.

```ts
// src/routes/api/todos.ts
import { createFileRoute } from "@tanstack/react-router";
import { getClient } from "@/client"; // your single in-worker client

export const Route = createFileRoute("/api/todos")({
  worker: {
    handlers: {
      GET: async () => Response.json(await getClient().list()),
      POST: async ({ request }) => {
        await getClient().add(await request.json());
        return new Response(null, { status: 204 });
      },
    },
  },
  // optional: a `server` handler for the same method is the no-worker
  // (first-load / SSR) fallback — see TanStack server routes.
});
```

Call them with `workerFetch(path, init)`, which resolves in the right place:

- **in the worker** (e.g. a `wsr` route's `loader` during a hard load) → runs the
  matched handler directly (a worker can't fetch itself);
- **on the main thread** (client navigation, event handlers) → `fetch`es the
  path, which the worker intercepts — the same path it renders on;
- **on the origin server** (SSR, no worker yet) → a `503`, so the caller can fall
  back (e.g. render an empty shell until the worker takes over).

```ts
import { workerFetch } from "@tinloof/tanstack-wsr/worker-fetch";

export const Route = createFileRoute("/")({
  wsr: true,
  loader: async () => {
    const res = await workerFetch("/api/todos"); // worker on hard load, fetch on nav
    return { todos: res.ok ? await res.json() : [] };
  },
  component: Todos,
});

// a mutation, from an event handler
await workerFetch("/api/todos", { method: "POST", body: JSON.stringify({ title }) });
```

Notes:

- Handlers are keyed by HTTP method (like server routes); model operations
  RESTfully (`POST`/`PATCH`/`DELETE`) or put an action in the body.
- The worker must be **registered and controlling** the page for main-thread
  calls (it is, right after it renders a document).
- To push live updates to pages (e.g. when synced data changes), call
  `broadcastToClients(message)` from a handler and have pages listen on
  `navigator.serviceWorker` to `router.invalidate()`.

## API

- `@tinloof/tanstack-wsr/vite` → `tanstackWsr({ router?, entry? })` — the Vite
  plugin (`router` defaults to `./src/router`, must export `getRouter`).
- `@tinloof/tanstack-wsr/react` → `<WsrRegister hot? />` — registers `/sw.js`;
  pass `import.meta.hot` for the dev auto-update bridge.
- `@tinloof/tanstack-wsr/worker-fetch` → `workerFetch(path, init)` and
  `broadcastToClients(message)`; the `worker` route option declares the handlers
  — see [Worker routes](#worker-routes).

## How it works

One route tree, one router. The service worker only acts on a **document (hard)
load**; in-app navigation stays a normal SPA transition.

```
 Hard load / reload / offline open
        │
        ▼
 ┌───────────────┐   any route in the matched chain has `wsr: true`?
 │ service worker│──────────────┬──────────────────────────┐
 └───────────────┘              │ yes                       │ no
                                ▼                            ▼
                  run the loaders + render         fetch(request) →
                  in-worker → return HTML →           origin handles it
                  hydrate via Start's bundle

 In-app navigation (<Link> / history) → the client router renders it;
 the service worker is not involved.
```

The gate is loader-free (pure path match) and **chain-aware** — if any route in
the matched chain is `wsr` (see [Nested routes](#nested-routes)), the whole
document renders in the worker; otherwise the request passes through untouched,
so a non-`wsr` route's loader never runs there. `wsr` pages reuse Start's client
entry for hydration — no extra bundle.

The worker bundle is compiled with TanStack Start's own **client** transform, so
it's a browser-grade environment: `createServerFn` becomes a network RPC (its
body and secrets stay on the origin, never in `/sw.js`), and you can call it from
a `wsr` loader or an event handler just like anywhere else in your app.

**Edits update the worker automatically in dev.** Service workers can't be
hot-swapped, so the plugin rebuilds `/sw.js` on every request and watches your
source; on save it signals the page through the `import.meta.hot` you pass to
`<WsrRegister>`, which pulls the new worker — it installs, takes control, and the
page reloads with it. Editing a `wsr` route or loader just shows up, with no
manual service-worker unregistering.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup and how releases are
published to npm.

## License

MIT
