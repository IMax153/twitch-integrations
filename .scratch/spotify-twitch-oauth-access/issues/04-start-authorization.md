# 04: Start a Provider authorization

**What to build:** The Broadcaster presses Connect on the Broadcaster Page and the browser is redirected to the Provider's consent screen with the correct scopes and a fresh state value. An Authorization Attempt bound to the Broadcaster's Access identity is recorded before the redirect.

**Blocked by:** 03 (Connection Durable Object)

**Status:** done

- [x] A `Provider` service interface with Spotify and Twitch implementations exposes authorize URL, token endpoint, client authentication style, scope list, and identity endpoint; scopes match the agreed lists
- [x] Provider Credentials are read as redacted config named `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, and `TWITCH_CLIENT_SECRET` in the Worker init and forwarded to the DO; `.env.example` lists them
- [x] An `AuthorizationFlow` service inside the DO starts an attempt for an `BroadcasterIdentity`: random state, Provider, callback URI, identity, creation and ten-minute expiry, then returns the consent URL
- [x] POST `/oauth/{provider}/authorize` reads the Access identity, derives the callback URI from the request origin plus the fixed callback path, calls the DO, and responds with a redirect to the consent URL
- [x] The consent URL carries client ID, response type code, redirect URI, scope, and state, with no PKCE parameters
- [x] GET on the authorize route is not accepted
- [x] Unknown Provider names respond with 404
- [x] Tests cover the redirect for both Providers, the stored attempt fields, and the identity binding

## Comments

Implemented on 2026-09-11. `apps/api/src/Provider.ts` holds the `Provider` service: a description per Provider (authorize URL, token endpoint, client authentication style, scope list, identity endpoint) plus that Provider's Credentials, chosen by name when the Connection object is built. `apps/api/src/ProviderCredentials.ts` reads the four Credentials as redacted config; the Worker init yields the config so Alchemy registers the secrets, and the object builds the service from the same config at runtime. `.env.example` lists them. `apps/api/src/AuthorizationFlow.ts` starts an Attempt: a state value from Effect's `Crypto` service (`apps/api/src/WebCrypto.ts` over the Web Crypto API in the Worker, `NodeCrypto` in tests), the Provider, the callback URI, the Broadcaster, creation and ten-minute expiry from the Clock, then the consent URL with client ID, response type, redirect URI, scope, and state. The object exposes `startAuthorization`, `Connections` forwards it, and POST `/oauth/:provider/authorize` resolves the Access identity, derives the callback URI from the request origin, and answers 303 to the consent URL. GET on the route and unknown Provider names answer 404.

The scope lists were agreed with the Broadcaster on 2026-09-11 and live in `Provider.ts`: Spotify `user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing`; Twitch `channel:read:redemptions`, `channel:manage:redemptions`, `user:read:chat`, `user:write:chat`, `moderator:manage:shoutouts`. A widened list only takes effect on the next authorization.

`alchemy plan --stage production` from the worktree shows `[Worker] update` and nothing else once the four Credentials are present in the env file; with them missing the plan fails on `SPOTIFY_CLIENT_ID`, so the main checkout's `.env` needs them before the next deploy.

Review follow-up: the two new services build their layers from a module-level `make`, the Worker-side `Connections` service is built from one `fromObjects` function that both the namespace stub and the test harness feed, the route helper that resolves the Broadcaster is named `readBroadcaster` so it no longer shares a name with the harness fixture, and an Access identity missing its user id or email is refused with 403 under test. The three Attempt tests consume through the store because no callback route exists yet; ticket 05 should move them onto `/oauth/{provider}/callback`.
