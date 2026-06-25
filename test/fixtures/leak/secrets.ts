// Distinctive markers the leak test greps for in the bundled worker output.
// SERVER_* are captured by server-only APIs and must NOT appear in /sw.js.
// CLIENT_VISIBLE_VALUE is used by a normal component and SHOULD appear (it's
// client code — same as it would in any browser bundle; documents the boundary).
export const SERVER_FN_SECRET = "LEAK_SERVERFN_a1b2c3";
export const SERVER_ONLY_SECRET = "LEAK_SERVERONLY_d4e5f6";
export const CLIENT_VISIBLE_VALUE = "CLIENT_VISIBLE_g7h8i9";
