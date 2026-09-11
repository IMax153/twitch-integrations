# 05: Complete an authorization, happy path

**What to build:** After consent the Provider redirects the Broadcaster back, the Worker exchanges the code, records which account was authorized, and returns the Broadcaster to the Broadcaster Page with a success message. The page now shows Authorized with the Connected Account, granted scopes, and expiry. Reconnecting replaces the previous Connection.

**Blocked by:** 04 (Start a Provider authorization)

**Status:** done

- [x] A closed fake `HttpClient` test layer routes by hostname to fake Spotify and Twitch token and identity endpoints, refuses unknown origins, and takes its scenario from a control service the test sets
- [x] `Provider.exchangeCode` submits the authorization code grant with the same callback URI; Spotify uses HTTP Basic client auth, Twitch puts client ID and secret in the form body
- [x] `Provider.fetchConnectedAccount` calls Spotify's current user profile or Twitch's token validation and returns account ID and display name
- [x] A `ConnectionLifecycle` service accepts a token response: keeps the previous refresh token if omitted, keeps previous scopes if omitted, computes absolute expiry from the response, sets Authorized, resets retries
- [x] Accepting with no refresh token and none stored sets Reauthorization Required
- [x] GET `/oauth/{provider}/callback` consumes the attempt with the current Access identity and request-derived callback URI, exchanges, fetches the Connected Account, accepts, and redirects to `/setup` with a success result
- [x] The Broadcaster Page shows Authorized, Connected Account, granted scopes, and expiry, and the button reads Reconnect
- [x] A second successful authorization overwrites the previous Connection entirely
- [x] No response body or header ever contains an access or refresh token
- [x] Tests run the full path through the Worker harness for both Providers and assert on redirects, page contents, and what the fake Provider received

## Comments

Implemented on 2026-09-11. `apps/api/src/Provider.ts` gained `exchangeCode` and `fetchConnectedAccount` over Effect's `HttpClient`: the code grant goes to the token endpoint as a form with `grant_type`, `code`, and the same `redirect_uri` the consent was started with, Spotify authenticating with HTTP Basic and Twitch with `client_id` and `client_secret` in the form. The identity call is Spotify's current user profile under `Bearer` and Twitch's token validation under `OAuth`, each decoded by a per-Provider wire Schema into a `ConnectedAccount`; Twitch's validation reports only `login`, so that is the Twitch display name. Any failure is a `ProviderRequestFailed` carrying the operation and a distilled reason (transport, status code, or body) and never the request or response, since those hold the Credentials and access token.

`apps/api/src/ConnectionLifecycle.ts` holds `accept`: it carries over the previous refresh token or scope list when the response omits them, computes absolute expiry from `expires_in` and the Clock, sets Authorized, resets retries, and sets Reauthorization Required when no refresh token exists anywhere. `AuthorizationFlow.complete` consumes the Attempt, exchanges, fetches the account, and accepts; the object's `completeAuthorization` turns every outcome into a `BroadcasterResult` so nothing but a string crosses the RPC boundary. GET `/oauth/:provider/callback` builds the claim from the Access identity and the request origin and answers 303 to `/setup?result=...`.

`ConnectionSummary` now carries the Connected Account, granted scopes, and expiry. RPC results cross the Durable Object boundary by structured clone, which keeps plain JSON intact but not `Option` or `DateTime` instances, so `describe` returns the summary encoded and the Worker serves it through the encoded side of the Schema. The Broadcaster Page renders the account as "name (id)", the scopes as a list, the expiry as ISO 8601, and Reconnect for anything but Not Configured.

Tests: `apps/api/test/FakeProviders.ts` is the closed fake `HttpClient`, routed by method, origin, and path to fake token and identity endpoints that enforce each Provider's client authentication and token scheme and refuse anything else; a control service sets the scenario per Provider and exposes every received request. The route tests cover both Providers end to end, what the fakes received, the page contents, the reconnect overwrite (tokens checked through the store, the only place they can be seen), and that no response body or header carries a token. The three Attempt tests ticket 04 left on the store now run through the callback. `ConnectionLifecycle` has its own tests over the store and `TestClock`.

For ticket 06: a replayed callback, an expired Attempt, and a callback under another Access identity all land on `attempt-mismatch` today, because `consumeAttempt` is one conditional UPDATE and cannot say why nothing matched; distinguishing `attempt-expired` and `identity-mismatch` needs the store to report the reason. A Provider `error` parameter currently falls through to `missing-code`. An identity lookup failure maps to `exchange-failed`, matching the spec's single message for a failed exchange.

Review follow-up: the two OAuth routes share one `oauthRoute` preamble that resolves the Provider and Broadcaster, the callback URI is built by one helper on both routes, the Provider error dropped its request-bearing cause, and the fake Providers are one per-Provider table rather than repeated branches. Not changed: the summary projection stays in the object rather than the domain package, which holds Schemas only.
