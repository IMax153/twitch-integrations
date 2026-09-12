# 08: A Redemption while Twitch is disconnected is refunded on reconnect

**What to build:** When a Redemption must be cancelled but the Twitch Connection is Not Configured or Reauthorization Required, the Channel cannot reach Twitch, so it stores the Redemption as held with the reason TwitchUnavailable and moves on. The next reconcile, which runs when the Broadcaster reconnects Twitch, cancels every held Redemption before touching the Reward or the Event Subscriptions, so the viewer gets their points back and the Broadcaster's request queue is clean when they go Live. Held is the only stored Redemption state; a Redemption that could be settled is never stored after processing.

**Blocked by:** 07

**Status:** done

- [x] A cancellation attempted while the Twitch Connection cannot hand out a token stores the Redemption as held instead of failing the drain
- [x] Processing continues with the next queued Redemption after a hold
- [x] Reconcile cancels every held Redemption first, in arrival order, then proceeds with the Reward and Event Subscriptions
- [x] A held Redemption that Twitch reports as no longer unfulfilled is dropped with a log line rather than retried
- [x] After settlement no held Redemptions remain, and a repeated reconcile makes no cancellation calls
- [x] Tests cover the hold, the settlement on reconcile, and the empty-after-settlement case over the fake Helix API under the TestClock

## Comments

Note from ticket 07 (2026-09-12): `SongRequests.cancel` takes `TwitchAccess.current` and fails with the Connection's own error when Twitch cannot hand out a token; `process` currently logs that and returns, so the Redemption leaves the Processing Queue. The hold belongs where that failure is caught, keyed on the `_tag` of `ConnectionNotConfigured` or `ReauthorizationRequired`, which arrive over the RPC as plain objects. The fake Helix's `redemptionUpdateRefusals` counts refusals of any Redemption update, so a cancel that Twitch refuses can be scripted the same way.

Implemented on 2026-09-12. The domain gains `HeldRedemption`: a Redemption with the hold reason `TwitchUnavailable`, the only stored Redemption state after processing. `SongRequests.cancel` asks `TwitchAccess.current` through `Effect.result`; a `ConnectionNotConfigured` or `ReauthorizationRequired` failure, matched on `_tag` since it arrives over the RPC as a plain object, stores the Redemption with `ChannelStore.holdRedemption` and returns, so the drain removes it from the Processing Queue and goes on. A `ProviderRequestFailed` from the Connection, or a Helix refusal of the cancel, is still logged and the Redemption dropped as ticket 07 left it. `ChannelReconcile` runs a settle step before `ensureReward`: it reads the held Redemptions in the order held, cancels each through Update Redemption Status, and releases it; a 404, which Twitch documents as "not found or their statuses weren't marked as UNFULFILLED", is logged as dropped and released too, never retried. Any other Helix failure fails the reconcile as the Reward and Event Subscription steps do, so the Redemption stays held for the next reconcile. No chat reply is sent on settlement: `TwitchUnavailable` is not a `CancellationReason`, so it has no wording, and the reply would arrive hours after the Redemption. Fakes: Helix takes `endedRedemptions`, the IDs it answers 404 for. Tests: the store's held table in `ChannelStore.test.ts`; the hold under Reauthorization Required across two Redemptions, the settlement in arrival order ahead of the Reward under Not Configured, the empty-after and no-calls-on-repeat case, and the 404 drop, all in `ChannelObject.test.ts` under the TestClock.
