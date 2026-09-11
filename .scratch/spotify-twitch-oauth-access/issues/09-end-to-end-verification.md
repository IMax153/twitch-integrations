# 09: End-to-end verification locally and in production

**What to build:** The Broadcaster can run the real authorization for both Providers on their machine, then deploy to the existing production stage and see both Connections Authorized on the deployed Broadcaster Page. Registering callback URIs and approving consent are human steps; this ticket carries a checklist for them.

**Blocked by:** 06 (Callback failure outcomes), 08 (Proactive refresh alarm and retry policy)

**Status:** ready-for-human

- [x] `.env.example` lists every Credential the Worker and Access application read
- [x] Root package scripts run `alchemy dev` with no stage and `alchemy deploy --stage production`
- [x] The README documents local setup, the callback URIs to register, and the deploy command
- [ ] Human steps: register the local (`http://127.0.0.1:5173`) and production (`https://twitch-integrations.minbadblue.com`) callback URIs from the README on the Spotify and Twitch developer applications, one application per Provider
- [ ] Human steps: run `alchemy dev`, open the Broadcaster Page, complete consent for both Providers, confirm Authorized with the expected Connected Account
- [ ] Human steps: wait past the refresh threshold locally or shorten expiry via the fake transport and confirm a refresh occurs
- [ ] Deploy to the `production` stage, confirm the Access login is required, complete consent for both Providers, and confirm both Connections show Authorized with next refresh scheduled
- [ ] Any defect found is fixed in this ticket or recorded as a new ticket

## Comments

Agent work done on 2026-09-11; the human steps remain open and the ticket is `ready-for-human`.

`.env.example` already listed all seven values (the Access GitHub application pair, `TWITCH_BROADCASTER_EMAIL`, and the two Provider Credential pairs); it now says what each is for. Root `package.json` gained `dev` (`alchemy dev`, no stage, so Alchemy's per-user dev stage and local storage are used) and `deploy` (`alchemy deploy --stage production`); both run through `vp run <name>`, since `vp dev` is a Vite+ built-in. The README was rewritten around the deployment: the Credentials table, the four callback URIs to register, the local run, how to observe a refresh, and the deploy plus its verification steps.

Defect found while reading Alchemy's local dev provider: every Worker defaults to dev port 1337 and slides to the next free port on collision. The API Worker asked for 1337 and the web Worker asked for nothing, so whichever started first owned 1337, and if the page took it the page's proxy for `/setup/api` and `/oauth` pointed at itself. The web Worker now pins port 5173 and the API Worker's 1337 is strict, so a collision fails at startup instead of silently misrouting. `alchemy plan --stage production` from the worktree reports both Workers as an update and every Access resource as a noop; the update is the changed dev props in the Worker inputs, not a change to what is deployed.

Callback URIs, from the Providers' documentation: Spotify accepts plain HTTP only for loopback IP literals, never `localhost`, so the local URIs use `http://127.0.0.1:5173/oauth/<provider>/callback` and the page is opened at `127.0.0.1`. Twitch's documentation shows `http://localhost` examples and does not say whether it accepts `127.0.0.1`; the README gives the `localhost` fallback for Twitch. The ticket's original mention of a workers.dev callback URI was stale: both Workers have workers.dev disabled (ADR 0002), so the checklist line now names the production URIs on `twitch-integrations.minbadblue.com`. Both Workers also bind `127.0.0.1` explicitly under `alchemy dev`, and the page's proxy targets that address, so the loopback URL the README gives works regardless of what `localhost` resolves to.

Not verified by the agent: that workerd derives the callback origin from the `Host` header the Vite proxy forwards (Vite keeps the browser's host when `changeOrigin` is unset), so the derived URI matches the registered `127.0.0.1:5173` one. The first local authorization confirms or refutes it; if a Provider reports a redirect URI mismatch, the fix is `changeOrigin` handling in `apps/web/vite.config.ts` or a fixed dev origin in the routes. Also not done from the worktree: `alchemy dev` itself and the production deploy, both of which are the Broadcaster's call and run from the main checkout with its `.env`.
