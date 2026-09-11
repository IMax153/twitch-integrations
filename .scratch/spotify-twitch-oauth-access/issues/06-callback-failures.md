# 06: Callback failure outcomes

**What to build:** Every way a callback can go wrong sends the Broadcaster back to the Broadcaster Page with a specific error message and leaves any existing Connection untouched.

**Blocked by:** 05 (Complete an authorization, happy path)

**Status:** ready-for-agent

- [ ] Denied consent (Provider error parameter) redirects with a denied message; the attempt is still consumed
- [ ] Missing code redirects with a missing code message
- [ ] Expired attempt redirects with an expired message
- [ ] A replayed callback for an already consumed attempt redirects with an invalid attempt message
- [ ] A callback under a different Access identity than the one that started the attempt redirects with an identity mismatch message
- [ ] Provider or callback URI mismatch redirects with an invalid attempt message
- [ ] Exchange failure (Provider 4xx, 5xx, or network error) redirects with an exchange failed message
- [ ] A malformed token response redirects with an exchange failed message
- [ ] Every failure leaves the previous Connection exactly as it was
- [ ] Unknown Provider names respond with 404
- [ ] Tests cover each outcome through the Worker harness using fake transport scenarios
