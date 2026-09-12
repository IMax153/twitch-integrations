# 05: Going Live and Offline pauses and unpauses the Reward

**What to build:** The receiver forwards verified stream online, stream offline, and revocation notifications to the Channel and acknowledges once the Channel has recorded them. The Channel sets Live or Offline, pauses the Reward on Twitch when Offline and unpauses it when Live, and records a revocation's reason on the affected Event Subscription. A notification Twitch resends with the same message ID is acknowledged and not processed again; seen message IDs are kept for 24 hours and then pruned. Notifications the Channel does not act on are acknowledged without being stored.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] The receiver's only binding is the Channel object namespace, and a verified notification of one of the three subscription types reaches the Channel's receive method
- [ ] A stream online notification makes the Channel Live and unpauses the Reward; a stream offline notification makes it Offline and pauses the Reward
- [ ] A revocation records its reason on the stored Event Subscription and returns 2xx
- [ ] A repeated message ID is acknowledged and causes no second pause or unpause call
- [ ] Message IDs older than 24 hours are pruned, verified under the TestClock
- [ ] A notification of an unknown subscription type or unknown reward ID returns 2xx and writes nothing
- [ ] Tests drive the receiver's fetch handler with signed notifications and assert on what the fake Helix API received
