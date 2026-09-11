# 02: Operator Page skeleton behind Access

**What to build:** The Operator opens `/setup` through Cloudflare Access and sees one section per Provider, each showing Not Configured with a Connect form button that does nothing yet. Any request to an operator route without an Access context gets a 403. The same page works under `alchemy dev` with a fake Access identity, and a Worker test harness exercises it without workerd.

**Blocked by:** 01 (Toolchain prep)

**Status:** in-review

- [x] GET `/setup` returns HTML with a Spotify section and a Twitch section, each showing Not Configured and a POST form to `/oauth/{provider}/authorize`
- [x] Routing uses Effect's `HttpRouter` fed into the Worker's fetch
- [x] Requests to any route under `/setup` or `/oauth` with no Access context return 403
- [ ] The Worker's dev Access option is set with `TWITCH_CHANNEL_OWNER_EMAIL` and a fixed dev `user_uuid`, so `alchemy dev` renders the page instead of 403
- [x] A test harness sends requests through Alchemy's request bridge with a fake execution context and a fake Access identity
- [x] Tests cover the 403 without Access and the rendered sections with Access
- [x] The page renders a success or error message from an optional result query parameter, with unknown values ignored

## Comments

Implemented on 2026-09-11. `OperatorRoutes.ts` builds Effect's `HttpRouter` into the Worker's fetch handler and gates the `/setup` and `/oauth` prefixes on the Access context before routing, so unmatched paths under those prefixes fail closed with 403 rather than 404. `OperatorPage.ts` renders one section per Provider with a POST form to `/oauth/{provider}/authorize`; the authorize route itself is left to ticket 04. `OperatorResult.ts` holds the result query parameter Schema and its messages; unknown values decode to nothing and render no message.

The Worker's `dev.access` reads `TWITCH_CHANNEL_OWNER_EMAIL` through `Config.String` nested in the props, which Alchemy resolves before the local provider lowers it into the env, and carries a fixed dev `user_uuid`. The `alchemy dev` run itself was not exercised here because no `.env` with Cloudflare credentials is present in the worktree, so that criterion stays unchecked until someone runs it.

Tests send Web requests through `makeRequestEffect` from `alchemy/Cloudflare/Workers` with a fake execution context and a `DEV_ACCESS_ENV_KEY` env entry for the fake identity. `@effect/vitest` was added at rc.113; its declared vitest peer range starts at 5.0 while the workspace pins 4.1.11, and it runs correctly against it.
