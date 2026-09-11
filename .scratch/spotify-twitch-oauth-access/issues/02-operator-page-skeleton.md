# 02: Operator Page skeleton behind Access

**What to build:** The Operator opens `/setup` through Cloudflare Access and the Operator Page app loads, fetches the Connections from the Worker, and shows one section per Provider, each Not Configured with a Connect form button that does nothing yet. Any request under `/setup` or `/oauth` without an Access context gets a 403, including the page's own files. The same page works under `alchemy dev` with a fake Access identity. A Worker test harness exercises the Worker without workerd, and Foldkit's story and scene tests cover the page without a browser.

**Blocked by:** 01 (Toolchain prep)

**Status:** in-review

- [x] `apps/web` is a Foldkit application built by Vite under the `/setup/` base path, with story and scene tests
- [x] The web app deploys as its own Worker on the `/setup*` route of `twitch-integrations.minbadblue.com`, and the api Worker owns the hostname with the `/setup/api*` route
- [x] GET `/setup/api/connections` returns a JSON array of `ConnectionSummary` with one Not Configured entry per Provider
- [x] The page renders one section per Provider showing its status and a POST form to `/oauth/{provider}/authorize`
- [x] Routing uses Effect's `HttpRouter` fed into the Worker's fetch
- [x] Requests to any route under `/setup` or `/oauth` with no Access context return 403
- [ ] Both Workers enroll in the Access application, so a signed-in Operator reaches the page and `ctx.access` is populated on the api Worker
- [ ] The api Worker's dev Access option is set with `TWITCH_CHANNEL_OWNER_EMAIL` and a fixed dev `user_uuid`, so `alchemy dev` renders the page instead of 403
- [x] A test harness sends requests through Alchemy's request bridge with a fake execution context and a fake Access identity
- [x] Tests cover the 403 without Access, the JSON route, and the rendered sections
- [x] The page renders a success or error message from an optional result query parameter, with unknown values ignored

## Comments

Implemented on 2026-09-11, first as an HTML string rendered by the Worker and then reworked into a Foldkit app after the decision recorded in ADR 0001. `apps/web/src/main.ts` holds the page's Model, Messages, update, and view; `apps/web/src/entry.ts` reads the result query parameter into Flags and starts the runtime. `apps/api/src/OperatorRoutes.ts` gates the `/setup` and `/oauth` prefixes on the Access context and answers `/setup/api/connections`. After the first deployment showed that a hostname-scoped Access application leaves `ctx.access` empty, ADR 0002 moved the deployment to `twitch-integrations.minbadblue.com` with two Workers: `apps/infra/src/Web.ts` deploys the page with Alchemy's Foldkit integration on `/setup*`, and `apps/api/src/Worker.ts` owns the hostname, keeps `/setup/api*`, and enrolls in the same Access application.

The api Worker's `dev.access` reads `TWITCH_CHANNEL_OWNER_EMAIL` through `Config.String` nested in the props and carries a fixed dev `user_uuid`. The `alchemy dev` run and the deployed Access flow were not exercised from the worktree, so those criteria stay unchecked until someone deploys and signs in. Frontend iteration runs `vp dev` in `apps/web`, which proxies `/setup/api` and `/oauth` to the local api Worker on port 1337.

Foldkit 0.158.2 pins Effect rc.112 and fails to load on the workspace's rc.113. `patches/foldkit@0.158.2.patch` ports the runtime changes from foldkit/foldkit pull request 1366; drop it when a Foldkit release targets rc.113. `@effect/vitest` was added at rc.113; its declared vitest peer range starts at 5.0 while the workspace pins 4.1.11, and it runs correctly.
