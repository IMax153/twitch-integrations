# 04: Connecting Twitch creates the Song Request Reward

**What to build:** A Channel Durable Object, one instance, that owns the Reward record, the Channel's Live or Offline state, and its Event Subscriptions. Its reconcile creates the Song Request Reward on the channel when none is stored and none with the title is manageable by this client ID, otherwise updates the existing one so every setting matches the spec (title "Song Request", cost 1, input required, no limits, no cooldown, never skipping the request queue, the spec's prompt). It then deletes every Event Subscription this client ID owns and creates the three afresh, seeds Live from Get Streams, and sets the Reward's pause state from that. Event Subscriptions use a Twitch app access token obtained by client credentials and cached in memory; every other call uses the Twitch Connection's token through `getAccessToken`. Reconcile runs after a successful Twitch authorization, called from the OAuth callback through a Worker-side Channel service, and when the object starts with stored settings that differ from the spec. Under `alchemy dev` reconcile never creates Event Subscriptions.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Domain schemas for Reward, ChannelState, and EventSubscription exist in the domain package with identifier annotations
- [ ] The Channel object hosts its own store over Durable Object SQLite, in the pattern of the Connection object
- [ ] Reconcile creates the Reward when none is stored and none is manageable with the title, and updates it in place otherwise; it never deletes a reward
- [ ] Reconcile replaces this client ID's Event Subscriptions with the redemption add subscription filtered to the Reward's ID, stream online, and stream offline, using the webhook secret as the transport secret and the receiver's callback URL
- [ ] Reconcile seeds Live from Get Streams and pauses or unpauses the Reward to match
- [ ] The app access token is fetched with the Twitch Credentials, cached until expiry, never stored, and never returned
- [ ] A successful Twitch authorization triggers reconcile; a Spotify authorization does not
- [ ] An object that starts with stored Reward settings different from the spec's constants reconciles itself
- [ ] Under `alchemy dev` reconcile skips Event Subscription creation and says so in a log line
- [ ] Tests cover create versus update, Event Subscription replacement, Live seeding, and both triggers, over the fake Helix API from ticket 02 and in-process objects
