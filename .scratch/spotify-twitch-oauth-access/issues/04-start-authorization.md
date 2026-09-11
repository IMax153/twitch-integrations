# 04: Start a Provider authorization

**What to build:** The Operator presses Connect on the Operator Page and the browser is redirected to the Provider's consent screen with the correct scopes and a fresh state value. An Authorization Attempt bound to the Operator's Access identity is recorded before the redirect.

**Blocked by:** 03 (Connection Durable Object)

**Status:** ready-for-agent

- [ ] A `Provider` service interface with Spotify and Twitch implementations exposes authorize URL, token endpoint, client authentication style, scope list, and identity endpoint; scopes match the agreed lists
- [ ] Provider Credentials are read as redacted config named `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, and `TWITCH_CLIENT_SECRET` in the Worker init and forwarded to the DO; `.env.example` lists them
- [ ] An `AuthorizationFlow` service inside the DO starts an attempt for an `OperatorIdentity`: random state, Provider, callback URI, identity, creation and ten-minute expiry, then returns the consent URL
- [ ] POST `/oauth/{provider}/authorize` reads the Access identity, derives the callback URI from the request origin plus the fixed callback path, calls the DO, and responds with a redirect to the consent URL
- [ ] The consent URL carries client ID, response type code, redirect URI, scope, and state, with no PKCE parameters
- [ ] GET on the authorize route is not accepted
- [ ] Unknown Provider names respond with 404
- [ ] Tests cover the redirect for both Providers, the stored attempt fields, and the identity binding
