# 02: Operator Page skeleton behind Access

**What to build:** The Operator opens `/setup` through Cloudflare Access and the Operator Page app loads, fetches the Connections from the Worker, and shows one section per Provider, each Not Configured with a Connect form button that does nothing yet. Any request under `/setup` or `/oauth` without an Access context gets a 403, including the page's own files. The same page works under `alchemy dev` with a fake Access identity. A Worker test harness exercises the Worker without workerd, and Foldkit's story and scene tests cover the page without a browser.

**Blocked by:** 01 (Toolchain prep)

**Status:** in-review

- [x] `apps/web` is a Foldkit application built by Vite under the `/setup/` base path, with story and scene tests
- [x] The api Worker ships the web build as static assets, routes every request through itself first, and serves the app shell for `/setup` and any non-API path under it
- [x] GET `/setup/api/connections` returns a JSON array of `ConnectionSummary` with one Not Configured entry per Provider
- [x] The page renders one section per Provider showing its status and a POST form to `/oauth/{provider}/authorize`
- [x] Routing uses Effect's `HttpRouter` fed into the Worker's fetch
- [x] Requests to any route under `/setup` or `/oauth` with no Access context return 403
- [ ] The Worker's dev Access option is set with `TWITCH_CHANNEL_OWNER_EMAIL` and a fixed dev `user_uuid`, so `alchemy dev` renders the page instead of 403
- [x] A test harness sends requests through Alchemy's request bridge with a fake execution context, a fake Access identity, and a fake assets service
- [x] Tests cover the 403 without Access, the JSON route, asset serving, and the rendered sections
- [x] The page renders a success or error message from an optional result query parameter, with unknown values ignored

## Comments

Implemented on 2026-09-11, first as an HTML string rendered by the Worker and then reworked into a Foldkit app after the decision recorded in ADR 0001. `apps/web/src/main.ts` holds the page's Model, Messages, update, and view; `apps/web/src/entry.ts` reads the result query parameter into Flags and starts the runtime. `apps/api/src/OperatorRoutes.ts` gates the `/setup` and `/oauth` prefixes on the Access context, serves the page through the `Assets` service, and answers `/setup/api/connections`. `apps/api/src/Worker.ts` builds the web app with a `Command.Build` step and ships `apps/web/dist/client` as worker-first assets with HTML handling disabled, so the Worker owns the `/setup` mapping.

The Worker's `dev.access` reads `TWITCH_CHANNEL_OWNER_EMAIL` through `Config.String` nested in the props and carries a fixed dev `user_uuid`. The `alchemy dev` run itself was not exercised because no `.env` with Cloudflare credentials is present in the worktree, so that criterion stays unchecked until someone runs it. Frontend iteration runs `vp dev` in `apps/web`, which proxies `/setup/api` and `/oauth` to the local Worker.

Foldkit 0.158.2 pins Effect rc.112 and fails to load on the workspace's rc.113. `patches/foldkit@0.158.2.patch` ports the runtime changes from foldkit/foldkit pull request 1366; drop it when a Foldkit release targets rc.113. `@effect/vitest` was added at rc.113; its declared vitest peer range starts at 5.0 while the workspace pins 4.1.11, and it runs correctly.
