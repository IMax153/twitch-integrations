# 04: Start a Provider authorization

**What to build:** The Operator presses Connect on the Operator Page and the browser is redirected to the Provider's consent screen with the correct scopes and a fresh state value. An Authorization Attempt bound to the Operator's Access identity is recorded before the redirect.

**Blocked by:** 03 (Connection Durable Object)

**Status:** done

- [x] A `Provider` service interface with Spotify and Twitch implementations exposes authorize URL, token endpoint, client authentication style, scope list, and identity endpoint; scopes match the agreed lists
- [x] Provider Credentials are read as redacted config named `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, and `TWITCH_CLIENT_SECRET` in the Worker init and forwarded to the DO; `.env.example` lists them
- [x] An `AuthorizationFlow` service inside the DO starts an attempt for an `OperatorIdentity`: random state, Provider, callback URI, identity, creation and ten-minute expiry, then returns the consent URL
- [x] POST `/oauth/{provider}/authorize` reads the Access identity, derives the callback URI from the request origin plus the fixed callback path, calls the DO, and responds with a redirect to the consent URL
- [x] The consent URL carries client ID, response type code, redirect URI, scope, and state, with no PKCE parameters
- [x] GET on the authorize route is not accepted
- [x] Unknown Provider names respond with 404
- [x] Tests cover the redirect for both Providers, the stored attempt fields, and the identity binding

## Comments

Implemented on 2026-09-11. `apps/api/src/Provider.ts` holds the `Provider` service: a description per Provider (authorize URL, token endpoint, client authentication style, scope list, identity endpoint) plus that Provider's Credentials, chosen by name when the Connection object is built. `apps/api/src/ProviderCredentials.ts` reads the four Credentials as redacted config; the Worker init yields the config so Alchemy registers the secrets, and the object builds the service from the same config at runtime. `.env.example` lists them. `apps/api/src/AuthorizationFlow.ts` starts an Attempt: a state value from `crypto.randomUUID`, the Provider, the callback URI, the Operator, creation and ten-minute expiry from the Clock, then the consent URL with client ID, response type, redirect URI, scope, and state. The object exposes `startAuthorization`, `Connections` forwards it, and POST `/oauth/:provider/authorize` resolves the Access identity, derives the callback URI from the request origin, and answers 303 to the consent URL. GET on the route and unknown Provider names answer 404.

The scope lists are this implementation's choice, since the reference lists were discarded with the reference document: Spotify `user-read-currently-playing` and `user-read-playback-state`; Twitch `channel:read:redemptions`, `channel:manage:redemptions`, `chat:read`, and `chat:edit`. Change them in `Provider.ts` before the first real Connect.

`alchemy plan --stage production` from the worktree shows `[Worker] update` and nothing else once the four Credentials are present in the env file; with them missing the plan fails on `SPOTIFY_CLIENT_ID`, so the main checkout's `.env` needs them before the next deploy.
