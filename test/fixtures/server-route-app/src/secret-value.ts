// Stands in for a server-only dependency (DB client, auth lib) imported by a
// server route handler. It must never reach /sw.js.
export const SERVER_ROUTE_SECRET = "LEAK_SERVER_ROUTE_zzz999";
