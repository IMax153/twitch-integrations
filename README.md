# Twitch integrations

A Vite+ monorepo using Janitor's formatting, linting, Effect TypeScript tooling, and shared TypeScript configuration.

## Setup

Use Node.js from `.node-version` and the pnpm version pinned in `package.json`. With Nix and direnv installed, run `direnv allow` to enter the development shell.

```sh
vp install
vp check
vp test
```

Installation patches the TypeScript and Oxlint tooling through `@effect/tsgo` and applies the Alchemy compatibility patches described in [patches/README.md](patches/README.md). Tests cover Alchemy's Effect compatibility.

## Workspace

- `apps/*` contains applications.
- `packages/*` contains shared packages.
- `tools/*` contains workspace tools.

No application packages are included yet. New packages should extend `tsconfig.base.json` and be added to the references in `tsconfig.workspace.json`. Use `catalog:` for shared dependencies. Effect is pinned to `4.0.0-rc.113`; the remaining catalog entries support development tooling.

Vite+ configuration lives in `vite.config.ts`. Run project scripts and tasks with `vp run <name>`. The pre-commit hook runs `vp staged`; after initializing Git, enable it with:

```sh
git config core.hooksPath .vite-hooks
```
