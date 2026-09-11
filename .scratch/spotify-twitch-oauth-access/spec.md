# Spotify and Twitch OAuth connections behind Cloudflare Access

Status: ready-for-agent

## Problem statement

The deployment needs to act on behalf of one Spotify account and one Twitch account during a stream, but nothing in the repo can obtain, store, or keep fresh the tokens those Providers issue. The only Operator-facing route today returns a placeholder behind Cloudflare Access. The Operator has no way to connect an account, see whether a Connection is healthy, or recover when a Provider revokes a refresh token.

## Solution

An Operator Page at `/setup`, reachable only through the existing Cloudflare Access application, shows the state of each Provider's Connection and offers a button to connect or reconnect it. Pressing the button starts a Provider authorization in the browser. After consent the Provider redirects back, the Worker exchanges the code, records which Connected Account was authorized, and sends the Operator back to the Operator Page with a result message. From then on a Durable Object keeps the Connection's access token fresh with a proactive alarm and an on-demand refresh, retries transient failures, and marks the Connection Reauthorization Required when the Provider rejects the refresh token. Future features ask the Connection for a valid access token and never touch OAuth directly.

## User stories

1. As an Operator, I want the Operator Page to require my Cloudflare Access login, so that nobody else can start or complete a Provider authorization.
2. As an Operator, I want any request to an operator route without an Access identity to be refused, so that a misconfigured Access application fails closed rather than open.
3. As an Operator, I want to see one section per Provider on the Operator Page, so that I can tell Spotify and Twitch apart at a glance.
4. As an Operator, I want each Provider section to show whether the Connection is Not Configured, Authorized, or Reauthorization Required, so that I know whether action is needed.
5. As an Operator, I want each Authorized Connection to show its Connected Account, so that I can confirm I authorized the right account.
6. As an Operator, I want each Connection to show the scopes the Provider granted, so that I can notice when a scope was withheld.
7. As an Operator, I want each Connection to show when the access token expires and when the next refresh is scheduled, so that I can judge whether refresh is working.
8. As an Operator, I want each Connection to show the last refresh error, if any, so that I can diagnose a problem without reading logs.
9. As an Operator, I want a Connect button for a Provider that is Not Configured, so that I can authorize it for the first time.
10. As an Operator, I want a Reconnect button for a Provider that is Authorized or Reauthorization Required, so that I can replace the Connection with a fresh authorization.
11. As an Operator, I want the Connect and Reconnect buttons to submit a form rather than follow a link, so that a page I merely visit cannot start an authorization on my behalf.
12. As an Operator, I want pressing Connect to redirect my browser to the Provider's consent screen with the correct scopes, so that I can approve access in one step.
13. As an Operator, I want the callback URL sent to the Provider to be derived from the host I am using, so that the same code works on localhost and on the deployed hostname.
14. As an Operator, I want each authorization to create a one-use Authorization Attempt that expires after ten minutes, so that a stale or replayed callback is rejected.
15. As an Operator, I want the Authorization Attempt to be bound to my Access identity, so that a callback completed from a different Access identity is rejected.
16. As an Operator, I want the callback to reject a mismatched state, provider, or callback URI, so that a forged callback cannot install tokens.
17. As an Operator, I want the Worker to exchange the authorization code for tokens using the Provider Credentials, so that I never handle tokens myself.
18. As an Operator, I want the Worker to look up the Connected Account after a successful exchange, so that the Operator Page can show who was authorized.
19. As an Operator, I want a successful callback to redirect me to the Operator Page with a success message, so that I get confirmation without seeing any token material.
20. As an Operator, I want a denied consent, a missing code, an expired attempt, an identity mismatch, or a failed exchange to redirect me to the Operator Page with a specific error message, so that I know what went wrong and can try again.
21. As an Operator, I want a failed callback to leave the previous Connection untouched, so that a botched reconnect does not break a working one.
22. As an Operator, I want a successful reconnect to replace the previous Connection entirely, so that the old account's tokens are gone.
23. As an Operator, I want the browser to never receive access or refresh tokens in any response, so that tokens stay inside the deployment.
24. As an Operator, I want the Connection to keep its previous refresh token when a Provider omits one from a token response, so that Spotify's non-rotating refresh tokens keep working.
25. As an Operator, I want the Connection to keep its previous scopes when a Provider omits them from a refresh response, so that the Operator Page stays accurate.
26. As an Operator, I want the Connection to become Reauthorization Required when a token response carries no refresh token and none was stored, so that the problem is visible rather than silent.
27. As an Operator, I want a refresh to be scheduled five minutes before the access token expires, so that tokens are fresh before anything needs them.
28. As an Operator, I want the scheduled refresh to survive Durable Object eviction, so that a cold start does not lose the schedule.
29. As an Operator, I want a refresh that fails with a network error or a rate limit to be retried after one, two, and four minutes, so that a transient outage recovers on its own.
30. As an Operator, I want a refresh that exhausts short retries or fails for an unknown reason to retry again after ten minutes, so that recovery keeps being attempted without hammering the Provider.
31. As an Operator, I want a refresh rejected with a client error other than rate limiting to mark the Connection Reauthorization Required and cancel further refreshes, so that I am prompted to reconnect instead of the deployment retrying forever.
32. As a future feature, I want to ask a Connection for a valid access token and receive the stored token when more than five minutes remain, so that ordinary calls do not trigger a refresh.
33. As a future feature, I want the same request to refresh and persist a new token when five minutes or less remain, so that I never receive a token about to expire.
34. As a future feature, I want the request to fail with a Not Configured error when no Connection exists, and a Reauthorization Required error when the Connection is in that state, so that I can surface the right message to the Operator.
35. As a future feature, I want concurrent token requests during a refresh to share the in-flight refresh rather than each contacting the Provider, so that a burst of calls does not cause duplicate refreshes.
36. As a future feature, I want refresh and token replacement to be serialized within a Connection, so that a reconnect racing an alarm cannot interleave writes.
37. As a future feature, I want a refresh triggered by a request to be the same code as the refresh triggered by an alarm, so that behavior does not diverge between the two paths.
38. As an Operator, I want to run the Worker locally with a fake Access identity, so that I can iterate on the Operator Page without deploying.
39. As an Operator, I want to run a real Spotify and Twitch authorization locally against callback URLs registered on the same Provider applications as production, so that I can test consent without a second set of Credentials.
40. As an Operator, I want local Durable Object storage to be separate from production storage, so that local experiments never overwrite production Connections.
41. As an Operator, I want Provider Credentials supplied through the same configuration mechanism as the existing Access Credentials, so that there is one way to provide secrets.
42. As an Operator, I want the example environment file to list every required Credential, so that setup on a new machine is a matter of filling it in.
43. As an Operator, I want deployment to keep targeting the `production` stage that is already deployed, so that no resources are duplicated.
44. As a developer, I want the domain types shared through a package with no Cloudflare dependencies, so that other apps can reuse them.
45. As a developer, I want the whole Connection layer graph to run in ordinary unit tests with no workerd, so that the test loop is fast.
46. As a developer, I want no test to ever reach a live Provider, so that the suite is deterministic and safe to run anywhere.

## Implementation decisions

### Packages and layout

- A new `packages/domain` workspace package holds Effect Schema definitions only. It exports `ProviderName`, `ConnectionStatus`, `Connection`, `ConnectedAccount`, `AuthorizationAttempt`, `OperatorIdentity`, `ConnectionSummary` (the JSON the Operator Page reads), `OperatorResult` (the result query parameter values), and Schema tagged errors. It imports nothing from Cloudflare or Alchemy.
- All services, their live layers, Provider wire-format schemas, and the Durable Object live in the existing `apps/api` package.
- The Operator Page is a Foldkit application in a separate `apps/web` workspace package. Vite builds it under the `/setup/` base path, and Alchemy's Foldkit integration deploys it as its own assets-only Worker on the `/setup*` route of `twitch-integrations.minbadblue.com`. The api Worker owns that hostname as its custom domain and keeps the `/setup/api*` route. See ADR 0002.
- The Access application in `apps/infra` has no hostname. Both Workers enroll in it through their `access` prop, which is what populates `ctx.access`. Access therefore covers each Worker entirely; a future public route lives on a separate Worker or hostname. The Worker-side 403 on the `/setup` and `/oauth` prefixes stays as the fail-closed backstop.
- Root package scripts run `alchemy dev` with no stage and `alchemy deploy --stage production`.

### Domain model

- `Connection` carries access token, refresh token, granted scopes, token type, absolute expiry, status, refresh retry count, next scheduled refresh time, last refresh error, and the `ConnectedAccount`. Tokens are `Redacted` in memory and serialized at the storage boundary. No application-level encryption.
- `ConnectionStatus` is Not Configured, Authorized, or Reauthorization Required.
- `AuthorizationAttempt` carries the random state value, Provider, callback URI, the Operator's Access `user_uuid` and email, creation time, expiry time, and a consumed flag.
- `OperatorIdentity` is the Access `user_uuid` and email.
- `ConnectedAccount` is the Provider account ID and display name.

### Runtime shape

- One Durable Object class, one instance per Provider, addressed by Provider name. It is declared with Alchemy's Effect-native Durable Object constructor and yielded in the Worker's init so the binding is registered automatically.
- The Durable Object hosts the entire layer graph. It exposes RPC methods to start an Authorization Attempt, complete one, get a valid access token, and describe the Connection for the Operator Page. It also owns the alarm handler.
- The api Worker is thin. It routes HTTP with Effect's `HttpRouter`, reads the Access identity, answers the page's JSON requests, and calls the Durable Object through a Worker-side Connections service that wraps the namespace RPC.
- Provider Credentials are read as `Config.Redacted` in the Worker init, named `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, and `TWITCH_CLIENT_SECRET`, and forwarded to the Durable Object. The Access application already reads `TWITCH_BROADCASTER_EMAIL`.
- Local development sets the api Worker's dev Access option with the broadcaster email and a fixed dev `user_uuid`, so the Access context resolves under `alchemy dev`. The web dev server proxies `/setup/api` and `/oauth` to the api Worker on port 1337.

### Services inside the Durable Object

- `Provider`: one tagged interface, two implementations. Each knows its authorize URL, token endpoint, client authentication style, scope list, and identity endpoint, and exposes `exchangeCode`, `refresh`, and `fetchConnectedAccount`. Spotify authenticates token requests with HTTP Basic; Twitch puts client ID and secret in the form body. Spotify's identity endpoint is the current user profile; Twitch's is token validation. Scopes copy the reference lists. No PKCE.
- `ConnectionStore`: persistence only, written against Effect's generic `SqlClient`. One row for the Connection as a Schema-validated JSON document, and a table of Authorization Attempts with real columns. Attempt consumption is a single conditional UPDATE on the state value, Provider, callback URI, Operator identity, unconsumed flag, and unexpired time, so it is atomic without an explicit transaction.
- `ConnectionLifecycle`: the rules. Accepts a token response with the refresh-token and scope fallbacks, computes expiry from the response, decides whether a refresh is due, runs the refresh under a semaphore shared with token replacement, applies the retry schedule, and transitions to Reauthorization Required on non-rate-limit client errors. All time comes from Effect's `Clock`.
- `AuthorizationFlow`: starts an attempt for an `OperatorIdentity` and returns the Provider redirect URL, and completes an attempt by consuming it, exchanging the code, fetching the Connected Account, and handing the result to `ConnectionLifecycle`.
- Refresh scheduling uses the raw Durable Object alarm. The next refresh time is stored on the Connection before the alarm is set, and the alarm handler re-reads it, so an evicted object resumes correctly. There is at most one pending refresh per Connection.
- Refresh runs proactively from the alarm and on demand from a token request. Both paths call the same lifecycle function. No stream-live gating.

### HTTP contract

- `GET /setup`, and any path under it outside `/setup/api`, is served by the web Worker: a static file when one matches, otherwise the app shell. The app reads an optional result query parameter in the browser and renders it as a success or error message.
- `GET /setup/api/connections` returns a JSON array of `ConnectionSummary`, one per Provider, which the page renders as its sections.
- `POST /oauth/{provider}/authorize` starts an attempt for the current Access identity and responds with a redirect to the Provider consent screen.
- `GET /oauth/{provider}/callback` completes the attempt and responds with a redirect to `/setup` carrying a result parameter. Every outcome, including denial, expiry, mismatch, and exchange failure, is a redirect with a distinct result value.
- Every route under `/setup` and `/oauth` on the api Worker responds with 403 when the Access context is absent.
- The callback URI is built from the incoming request's origin plus the fixed callback path.
- Responses never include access or refresh tokens.

### Storage

- `SqlClient` in production comes from the Durable Object SQLite adapter package over the raw storage handle Alchemy exposes. Tables are created on first use through the same store code, using Effect's migrator if it fits, otherwise idempotent DDL.

## Testing decisions

A good test drives the system from the outside and asserts on observable results: the HTTP response, what the fake Provider received, and what a later request observes. Tests never inspect internal state, never mock modules, and substitute behavior only by providing a different Effect layer.

- Primary surface: HTTP requests through the api Worker's fetch handler using Alchemy's request bridge with a fake execution context and a fake Access identity. This covers the JSON route, authorize, callback, identity binding, and the 403 gate.
- The Operator Page's update and view are covered by Foldkit's story and scene tests in `apps/web`, with no browser.
- Three substitutions make that run without workerd:
  1. A closed fake `HttpClient` that routes by hostname to fake Spotify and Twitch endpoints, refuses any unknown origin, and takes its scenario from a control service the test sets. Scenarios include success, denied consent, rotated refresh token, omitted refresh token, rate limit, network failure, non-rate-limit client error, and malformed response.
  2. `SqlClient` from the Node SQLite adapter package over an in-memory database, running the real `ConnectionStore`.
  3. The Worker-side Connections service provided by the Durable Object's own RPC implementation constructed in-process over substitutions 1 and 2.
- Lifecycle behavior with no HTTP trigger, namely the alarm, retry timing, the five-minute refresh threshold, refresh sharing under concurrency, and Reauthorization Required transitions, is tested by invoking the Durable Object's alarm Effect and token-request method directly over the same substitutions under Effect's `TestClock`.
- Modules under test: the Worker routes, the Operator Page's update and view, `AuthorizationFlow`, `ConnectionLifecycle`, `ConnectionStore`, and both `Provider` implementations. The `SqlClient` adapters themselves are not tested.
- No workerd-backed tier in this spec. Native alarm dispatch and Durable Object binding are verified by the local dev run.
- Prior art in this repo is limited to the Alchemy compatibility tests, which run Effects under the Vite+ test runner. The layer-substitution style of the reference project is the model.

## Out of scope

- EventSub subscriptions, stream online and offline handling, and any refresh gating on stream state.
- The Twitch app access token via client credentials and Spotify's auxiliary client token.
- Any feature that consumes a Connection's access token.
- A Disconnect action or Provider-side token revocation. Reconnect overwrites.
- PKCE.
- Enforcing that the Connected Account matches a configured broadcaster.
- A deployed non-production stage or a stage-name guard.
- Application-level encryption of stored tokens.
- A workerd-backed integration test tier.
- Foldkit server rendering. The page is client-rendered until `foldkit/experimental/server` stabilizes.
- Any architecture decision record.

## Further notes

- Foldkit pins an exact Effect release candidate. Until Foldkit publishes rc.113 support, the workspace carries a pnpm patch porting its rc.113 changes, recorded in `patches/README.md`.
- Dependency policy: track the latest Effect release candidate and the latest Alchemy beta. Where Alchemy lags Effect's breaking changes, pin through pnpm overrides and carry patches in the patches directory, as the repo already does. The Durable Object and Node SQLite adapter packages should be added to the catalog at the same Effect release as the rest of the workspace, and installation should be checked for a duplicate Effect resolution.
- Cloudflare Access itself does the JWT verification at the edge. Alchemy's Access context is a view of workerd's already verified data and only exists for URLs the Access application covers. The 403 on a missing context is therefore the real gate, and every new operator route must stay under a covered path prefix.
- The stack has only ever been deployed under the `production` stage. Do not deploy under any other stage name without expecting a second set of resources.
- The reference document this design started from has been discarded. This spec and the glossary in `CONTEXT.md` are the source of truth.
