# 02: Operator Page skeleton behind Access

**What to build:** The Operator opens `/setup` through Cloudflare Access and sees one section per Provider, each showing Not Configured with a Connect form button that does nothing yet. Any request to an operator route without an Access context gets a 403. The same page works under `alchemy dev` with a fake Access identity, and a Worker test harness exercises it without workerd.

**Blocked by:** 01 (Toolchain prep)

**Status:** ready-for-agent

- [ ] GET `/setup` returns HTML with a Spotify section and a Twitch section, each showing Not Configured and a POST form to `/oauth/{provider}/authorize`
- [ ] Routing uses Effect's `HttpRouter` fed into the Worker's fetch
- [ ] Requests to any route under `/setup` or `/oauth` with no Access context return 403
- [ ] The Worker's dev Access option is set with `TWITCH_CHANNEL_OWNER_EMAIL` and a fixed dev `user_uuid`, so `alchemy dev` renders the page instead of 403
- [ ] A test harness sends requests through Alchemy's request bridge with a fake execution context and a fake Access identity
- [ ] Tests cover the 403 without Access and the rendered sections with Access
- [ ] The page renders a success or error message from an optional result query parameter, with unknown values ignored
