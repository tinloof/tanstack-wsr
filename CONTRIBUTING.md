# Contributing

## Layout

The repo **root is the package** (`@tinloof/tanstack-wsr`):

- `src/` — package source (`vite.ts`, `react.tsx`, `worker.tsx`, …), built to
  `dist/` with [tsdown](https://tsdown.dev).
- `examples/recipes/` — a TanStack Start app that consumes the package
  (workspace dependency `@tinloof/tanstack-wsr: workspace:*`).

It's a pnpm workspace; the example is the only member.

## Dev setup

```sh
pnpm install      # also builds the package to dist/ (via the `prepare` script)
pnpm dev          # runs examples/recipes on http://localhost:3000
```

The example imports the package from its built `dist/`. After editing the
package source, rebuild so the example picks it up:

```sh
pnpm build        # tsdown: src/ → dist/
# or, while iterating:
pnpm exec tsdown --watch
```

Other scripts: `pnpm example:build`, `pnpm example:deploy` (Cloudflare),
`pnpm format` / `pnpm lint` / `pnpm check` (Biome).

A **pre-commit hook** (`.githooks/pre-commit`, activated on install via
`prepare`) runs `biome check --staged --write` and re-stages the fixes, so
formatting/safe fixes land automatically and match CI. Bypass with
`git commit --no-verify`.

## Releasing to npm

1. Make your change.
2. Add a changeset describing it and the bump (patch / minor / major):
   ```sh
   pnpm changeset
   ```
3. Commit and push to `main` (open a PR and merge).
4. The **Release** workflow opens a **"Version Packages"** PR (bumps the version
   - updates `CHANGELOG.md`).
5. **Merge that PR** → the workflow publishes the new version to npm. 🎉
