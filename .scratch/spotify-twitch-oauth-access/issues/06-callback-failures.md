# 06: Callback failure outcomes

**What to build:** Every way a callback can go wrong sends the Broadcaster back to the Broadcaster Page with a specific error message and leaves any existing Connection untouched.

**Blocked by:** 05 (Complete an authorization, happy path)

**Status:** done

- [x] Denied consent (Provider error parameter) redirects with a denied message; the attempt is still consumed
- [x] Missing code redirects with a missing code message
- [x] Expired attempt redirects with an expired message
- [x] A replayed callback for an already consumed attempt redirects with an invalid attempt message
- [x] A callback under a different Access identity than the one that started the attempt redirects with an identity mismatch message
- [x] Provider or callback URI mismatch redirects with an invalid attempt message
- [x] Exchange failure (Provider 4xx, 5xx, or network error) redirects with an exchange failed message
- [x] A malformed token response redirects with an exchange failed message
- [x] Every failure leaves the previous Connection exactly as it was
- [x] Unknown Provider names respond with 404
- [x] Tests cover each outcome through the Worker harness using fake transport scenarios

## Comments

Implemented on 2026-09-11. `ConnectionStore.consumeAttempt` now fails with `AuthorizationAttemptRejected` carrying a reason instead of answering false. The conditional UPDATE is unchanged, so consumption stays atomic; when it matches nothing, one SELECT by state value explains why, in order of how much the callback may be told: an unknown state value, an already consumed Attempt, or a different Provider or callback URI is `Mismatch`; a different Broadcaster is `IdentityMismatch`; only a claim that is otherwise right learns the Attempt is `Expired`. A claim that lost a concurrent race reads the row as consumed and so lands on `Mismatch` too. `AuthorizationFlow` no longer defines its own rejection error and passes the store's through; the object maps each reason to `attempt-expired`, `identity-mismatch`, or `attempt-mismatch`.

Denied consent: the callback route checks for a Provider `error` parameter before the code, whatever the error value, and calls the new `abandonAuthorization` on the object, which runs `AuthorizationFlow.abandon`: it consumes the Attempt and nothing else, so the state value cannot be presented again, and reports `denied`, or the rejection reason if the claim did not match. A missing code with no error still answers `missing-code` at the route without touching the Attempt. Exchange failures and a malformed token response already mapped to `exchange-failed` through `ProviderRequestFailed`, and the Connection is only written by `ConnectionLifecycle.accept` after everything succeeded, so no failure path can touch it. Unknown Provider names answer 404 through the shared route preamble.

Tests: the fake token endpoint takes a `TokenEndpoint` scenario, a grant or one of `Status`, `Unreachable`, or `Malformed`; the identity endpoint refuses any token when nothing was granted. The route tests run a table of every failure against a Spotify store holding an existing Connection, asserting the result parameter and that the stored Connection is byte-for-byte what it was: denied consent, missing code, expired Attempt, replayed callback, another Access identity, another Provider's state value, another origin, and the exchange meeting 400, 429, 500, a network failure, and a malformed body. Separate tests cover the denied path consuming the Attempt, the missing code not consuming it, and the 404 on an unknown Provider callback. The store tests assert each rejection reason, including that a replay under another identity is a mismatch and that an identity mismatch is reported ahead of expiry.

Review follow-up: a denial after the Attempt expired now reports `denied` rather than `attempt-expired`, since the Broadcaster's denial is the outcome and the expired Attempt cannot be used anyway; any other rejection of a denied callback still reports its reason. A Twitch exchange failure runs through the harness too. The callback route reads as an if cascade, the object's rejection helper takes the store's error type, and the fake identity endpoint takes the account rather than the whole scenario. Not changed: a callback with neither code nor error leaves the Attempt live, so the Broadcaster can still finish the same consent; the store's disclosure order for rejection reasons stays, since it decides what a forged callback learns.
