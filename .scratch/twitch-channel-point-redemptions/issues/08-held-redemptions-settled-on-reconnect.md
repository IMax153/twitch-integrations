# 08: A Redemption while Twitch is disconnected is refunded on reconnect

**What to build:** When a Redemption must be cancelled but the Twitch Connection is Not Configured or Reauthorization Required, the Channel cannot reach Twitch, so it stores the Redemption as held with the reason TwitchUnavailable and moves on. The next reconcile, which runs when the Broadcaster reconnects Twitch, cancels every held Redemption before touching the Reward or the Event Subscriptions, so the viewer gets their points back and the Broadcaster's request queue is clean when they go Live. Held is the only stored Redemption state; a Redemption that could be settled is never stored after processing.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] A cancellation attempted while the Twitch Connection cannot hand out a token stores the Redemption as held instead of failing the drain
- [ ] Processing continues with the next queued Redemption after a hold
- [ ] Reconcile cancels every held Redemption first, in arrival order, then proceeds with the Reward and Event Subscriptions
- [ ] A held Redemption that Twitch reports as no longer unfulfilled is dropped with a log line rather than retried
- [ ] After settlement no held Redemptions remain, and a repeated reconcile makes no cancellation calls
- [ ] Tests cover the hold, the settlement on reconcile, and the empty-after-settlement case over the fake Helix API under the TestClock
