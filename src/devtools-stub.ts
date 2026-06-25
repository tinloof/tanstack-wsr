// No-op stand-in for the Solid-based TanStack devtools in the SERVICE-WORKER
// bundle only. The worker's standalone build aliases the devtools packages
// (@tanstack/react-devtools, react-router-devtools, devtools, router-devtools-core)
// to this file (see resolve.alias in vite.ts). They're never rendered in the
// worker — the worker renders them to null — so we keep their Solid dependency
// out of /sw.js entirely. The real (client-only) devtools still load from the
// app's normal bundle and mount after hydration via a portal, so there's no
// hydration mismatch.
//
// Aliasing is used instead of a resolveId plugin because Rolldown's native
// resolver does not call JS resolveId hooks for node_modules specifiers; an
// alias to a real on-disk file is the mechanism it honors.
export const TanStackDevtools = () => null;
export const TanStackRouterDevtoolsPanel = () => null;
export default {};
