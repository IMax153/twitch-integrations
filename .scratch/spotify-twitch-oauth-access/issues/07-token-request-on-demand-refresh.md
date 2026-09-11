# 07: Token request with on-demand refresh

**What to build:** A caller inside the deployment can ask a Provider's Connection for a valid access token and always gets one that is fresh, or a typed error explaining why not. Concurrent callers never cause duplicate refreshes.

**Blocked by:** 05 (Complete an authorization, happy path)

**Status:** ready-for-agent

- [ ] The DO exposes a get-access-token RPC backed by `ConnectionLifecycle`
- [ ] With no Connection it fails with a Not Configured error; with status Reauthorization Required it fails with that error without contacting the Provider
- [ ] With more than five minutes remaining it returns the stored token without contacting the Provider
- [ ] With five minutes or less remaining it refreshes via `Provider.refresh`, accepts the response with the same fallback rules as ticket 05, persists, and returns the new token
- [ ] A refresh rejected with a non-rate-limit 4xx sets Reauthorization Required and the request fails with that error
- [ ] Refresh and token replacement are serialized by a semaphore within the DO, and expiry is rechecked under the lock before contacting the Provider
- [ ] Concurrent requests during a refresh share the in-flight refresh and all receive the same new token
- [ ] Tests invoke the RPC directly over the fake transport and in-memory store under `TestClock`, covering each branch and the concurrency case
