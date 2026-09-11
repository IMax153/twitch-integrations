# 07: Token request with on-demand refresh

**What to build:** A caller inside the deployment can ask a Provider's Connection for a valid access token and always gets one that is fresh, or a typed error explaining why not. Concurrent callers never cause duplicate refreshes.

**Blocked by:** 05 (Complete an authorization, happy path)

**Status:** done

- [x] The DO exposes a get-access-token RPC backed by `ConnectionLifecycle`
- [x] With no Connection it fails with a Not Configured error; with status Reauthorization Required it fails with that error without contacting the Provider
- [x] With more than five minutes remaining it returns the stored token without contacting the Provider
- [x] With five minutes or less remaining it refreshes via `Provider.refresh`, accepts the response with the same fallback rules as ticket 05, persists, and returns the new token
- [x] A refresh rejected with a non-rate-limit 4xx sets Reauthorization Required and the request fails with that error
- [x] Refresh and token replacement are serialized by a semaphore within the DO, and expiry is rechecked under the lock before contacting the Provider
- [x] Concurrent requests during a refresh share the in-flight refresh and all receive the same new token
- [x] Tests invoke the RPC directly over the fake transport and in-memory store under `TestClock`, covering each branch and the concurrency case

## Comments

Implemented on 2026-09-11. `Provider` gained `refresh`, which submits the refresh token grant to the token endpoint through the same helper as the code exchange, so Spotify authenticates with HTTP Basic and Twitch with the Credentials in the form; a failure is a `ProviderRequestFailed` with operation `refresh`.

`ConnectionLifecycle` now holds one permit-wide semaphore that `accept`, `refresh`, and `requestAccessToken` all take, so a token replacement and a refresh never interleave their read-then-write of the Connection. `requestAccessToken` reads the Connection, fails `ConnectionNotConfigured` with none and `ReauthorizationRequired` when the Provider has rejected the refresh token, both without contacting the Provider, and returns the stored token while more than five minutes remain. At five minutes or less it takes the lock, re-reads and rechecks the expiry, and only then refreshes: a request that queued behind another's refresh finds the new token and returns it without a second Provider call, which is how concurrent requests share one in-flight refresh. The refresh response is installed by the same function `accept` uses, so an omitted refresh token or scope list is carried over and the Connected Account is kept. A refresh the Provider answers with any 4xx but 429 writes Reauthorization Required and fails with that error; a rate limit, a 5xx, a network failure, or a malformed body fails with the `ProviderRequestFailed` and leaves the Connection as it was. `refresh` is exposed on the service for ticket 08's alarm so both paths run the same code.

The object exposes `getAccessToken`, returning the plain token string since `Redacted` does not survive the RPC boundary; the Worker-side `Connections.getAccessToken` wraps it in `Redacted` again. Failures cross Alchemy's RPC as plain objects carrying their tag and fields, so the Worker can match on `_tag` but must not rely on `instanceof`. No Worker route consumes the token: features that use it are out of scope.

Tests: `apps/api/test/ConnectionObject.test.ts` calls the object's RPC directly through the harness, which now exposes the in-process objects, under `TestClock`: Not Configured, Reauthorization Required, the stored token at 5:01 remaining, the refresh at exactly 5:00 remaining for both Providers with what each fake received, the carry-over rules, the transition on a 400 and that the next request does not ask again, a table of the four transient failures leaving the Connection untouched, and two concurrent requests during a refresh held in flight by a new latency knob on the fake scenario, with one Provider request between them. Removing the recheck under the lock makes that last test fail with two requests. The fake Credentials layer moved next to the fake Providers that expect them, and the lifecycle tests provide the Spotify Provider now that the lifecycle depends on it for the error's Provider name.
