# Song Requests through Twitch channel point redemptions

Status: draft

## Problem statement

The deployment holds an Authorized Twitch Connection and an Authorized Spotify Connection, and nothing consumes either. The Broadcaster wants viewers to spend channel points to put a song on the stream's Spotify queue, with the deployment doing the work: noticing the Redemption, queueing the track, telling chat, and refunding the viewer when it cannot. Twitch delivers Redemptions over EventSub, which needs a public callback, and ADR 0002 records that Cloudflare Access covers both current Workers entirely, so no public path exists today. The OAuth spec also left stream online and offline handling out of scope, and a Song Request has no meaning while the stream is Offline.

## Solution

The deployment owns one Reward on the Twitch channel, Song Request, costing one channel point and requiring the viewer to paste a Spotify track link. A new Channel Durable Object creates the Reward and three Event Subscriptions whenever the Twitch Connection is authorized, learns whether the channel is Live, and pauses the Reward while it is Offline. A third Worker, outside Cloudflare Access, receives Twitch's webhook notifications on the shared hostname, verifies them, hands them to the Channel, and acknowledges. The Channel processes Redemptions one at a time: it adds the track to the Broadcaster's Spotify queue through the Spotify Connection, fulfils the Redemption through the Twitch Connection, and replies in chat as the Twitch Connected Account. Every failure cancels the Redemption, which refunds the viewer, and says why in chat. Neither Worker nor the Channel ever handles OAuth; both ask a Connection for a valid access token.

## User stories

### The Reward

1. As a Broadcaster, I want the deployment to create a Song Request Reward on my channel once Twitch is connected, so that I never set it up in the Twitch dashboard.
2. As a Broadcaster, I want the Reward to cost one channel point, require viewer input, have no per-stream or per-user limit and no cooldown, and never skip Twitch's request queue, so that requests are as cheap as possible and every Redemption can still be refunded.
3. As a Broadcaster, I want the deployment to correct the Reward's settings on Twitch whenever they differ from this spec, so that a change to the spec reaches my channel without me reconnecting Twitch.
4. As a Broadcaster, I want a successful Twitch reconnect to run the same reconciliation, so that a fresh Connected Account gets the Reward and Event Subscriptions too.
5. As a Broadcaster, I want the deployment to leave rewards I made in the Twitch dashboard alone, so that only the Reward it owns is ever paused, fulfilled, or cancelled.

### A Redemption while Live

6. As a viewer, I want to paste a Spotify track link as the Reward's input and hear the track queued on the stream's Spotify, so that I can request a song without the Broadcaster doing anything.
7. As a viewer, I want a track page URL or a `spotify:track:` URI to both be accepted, so that whichever share option Spotify gave me works.
8. As a viewer, I want a chat reply naming the track and artist when my request is queued, so that I know it worked.
9. As a viewer, I want my Redemption fulfilled on Twitch when the track is queued, so that it leaves the Broadcaster's request queue.
10. As a Broadcaster, I want Redemptions processed one at a time in the order they arrived, so that the Spotify queue matches the order viewers redeemed in.

### A Redemption that fails

11. As a viewer, I want a link that is not a Spotify track link to be refused with a chat reply and my points refunded, so that a typo does not cost me anything.
12. As a viewer, I want a request made while Spotify has nothing playing to be refunded with a chat reply saying so, so that I can try again once music is on.
13. As a viewer, I want a request that fails for any other reason, such as Spotify being disconnected or unreachable, to be refunded with a chat reply, so that I never lose points to the deployment's problems.
14. As a Broadcaster, I want every failed Redemption cancelled rather than left in my request queue, so that I never clean up by hand mid-stream.
15. As a Broadcaster, I want a chat reply that fails to send to be logged without changing what happened to the Redemption, so that chat trouble never causes a wrong fulfilment or refund.
16. As a viewer, I want a Redemption that was queued but could not be marked fulfilled to stay unfulfilled rather than be refunded, so that I am not paid back for a song I received.

### Live and Offline

17. As a Broadcaster, I want the Reward paused on Twitch while I am Offline and unpaused when I go Live, so that viewers cannot spend points on requests nobody will hear.
18. As a viewer, I want a Redemption that still arrives while the channel is Offline to be refunded with a chat reply, so that a request made in the moments around stream end is not lost.
19. As a Broadcaster, I want the deployment to learn whether I am Live from Twitch when Twitch is connected and to follow Twitch's online and offline notifications afterwards, so that the state is right after a restart and stays right during a stream.
20. As a Broadcaster, I want the deployment to treat an unknown state as Offline, so that it never queues songs before it knows I am streaming.

### Twitch is disconnected

21. As a viewer, I want a Redemption that arrives while the Twitch Connection is Reauthorization Required to be held and refunded as soon as the Broadcaster reconnects, so that the deployment's lost authorization does not keep my points.
22. As a Broadcaster, I want the reconciliation after a reconnect to settle every held Redemption before doing anything else, so that the queue on Twitch is clean when I go Live.

### Receiving notifications

23. As a Broadcaster, I want Twitch's notifications received on a path of the existing hostname that Cloudflare Access does not cover, so that Twitch can reach the deployment without an Access login and nothing else about the deployment changes.
24. As a Broadcaster, I want the receiver to verify Twitch's signature before doing anything else and to refuse anything that fails, so that only Twitch can cause a Redemption to be processed.
25. As a Broadcaster, I want the receiver to refuse a notification whose timestamp is older than ten minutes, so that a captured notification cannot be replayed later.
26. As a Broadcaster, I want a notification Twitch resends with the same message ID to be processed at most once, so that a retry never queues a song twice or refunds twice.
27. As a Broadcaster, I want the receiver to answer Twitch's callback verification challenge, so that Event Subscriptions become enabled.
28. As a Broadcaster, I want the receiver to record the notification and acknowledge within a few seconds, and the Channel to do the slow work afterwards, so that Twitch never revokes the Event Subscriptions for slow responses.
29. As a Broadcaster, I want notifications the deployment does not act on, such as an unknown reward or subscription type, acknowledged and discarded without being stored, so that the receiver cannot be used to fill storage.
30. As a Broadcaster, I want a revocation recorded with its reason, so that the next reconciliation can recreate the Event Subscription and I can read why it was lost.
31. As a Broadcaster, I want the receiver to answer every other path and method with an empty 404, to refuse oversized bodies, to hold no Provider Credentials, and to have no workers.dev URL, so that the one public Worker exposes as little as possible.

### Development and testing

32. As a Broadcaster, I want to run the receiver locally under `alchemy dev` and drive it with the Twitch CLI's signed test notifications, so that I can exercise the whole path without a public callback.
33. As a Broadcaster, I want the webhook secret supplied like every other Credential, so that there is still one way to provide secrets.
34. As a developer, I want the Channel, the receiver, and the Song Request rules to run in ordinary unit tests with no workerd, so that the test loop stays fast.
35. As a developer, I want no test to ever reach Twitch or Spotify, so that the suite stays deterministic and safe to run anywhere.

## Implementation decisions

### Packages and layout

- `packages/domain` gains the Schema definitions for `Reward`, `Redemption`, `RedemptionOutcome`, `ChannelState` (Live or Offline), `EventSubscription`, and the Song Request input parser's result types. As before it imports nothing from Cloudflare or Alchemy.
- The Channel Durable Object, its services, and the Twitch Helix and Spotify Web API wire-format schemas live in `apps/api`, next to the Connection object, so both objects share the Worker's bindings and the existing `Provider` code.
- The receiver is a new `apps/eventsub` workspace package deploying a third Worker on the route `stream.minbadblue.com/eventsub*` on the shared hostname. It does not enroll in the Access application. Cloudflare routes take precedence over a custom domain on the same hostname, which is how the web Worker's `/setup*` route already works. ADR 0002 is amended to record this.
- The receiver's only binding is the Channel Durable Object namespace, plus the webhook secret. It reads no Provider Credentials.
- The API Worker keeps the OAuth callback. After a successful Twitch authorization it calls the Channel's reconcile through a Worker-side service wrapping the namespace RPC, in the same style as the existing Connections service.

### Domain model

- `Reward` carries the Twitch reward ID, the title, cost, prompt, and the pause state the deployment last set. The spec fixes the settings: title "Song Request", cost 1, input required, no per-stream or per-user limit, no cooldown, `should_redemptions_skip_request_queue` false. The prompt tells the viewer to paste a Spotify track link.
- `Redemption` carries the Twitch redemption ID, the reward ID, the viewer's user ID and display name, the raw input, and the time redeemed. A `Redemption` held under story 21 is stored with a reason `TwitchUnavailable`; that is the only stored Redemption state.
- `RedemptionOutcome` is one of Fulfilled, or Cancelled with a reason: NotATrackLink, NothingPlaying, Offline, SpotifyUnavailable, or Failed. Each reason maps to exactly one chat reply.
- `ChannelState` is Live or Offline. There is no third value; a Channel that has never been seeded is Offline.
- `EventSubscription` carries the Twitch subscription ID, type, version, status, and the last revocation reason if any. The three types are `channel.channel_points_custom_reward_redemption.add` version 1 with the Reward's ID in the condition, `stream.online` version 1, and `stream.offline` version 1.
- A Song Request input is accepted when it is a URL on `open.spotify.com` whose path is `/track/<id>`, with any query string ignored, or the URI `spotify:track:<id>`. Everything else is NotATrackLink.

### The Channel object

- One Durable Object class, one instance, addressed by a fixed name. Like the Connection object it hosts its own layer graph and exposes RPC methods: `reconcile`, `receive` for a verified notification, and `describe` for later use by the Broadcaster Page. It owns no alarm in this spec.
- The Channel obtains a Twitch app access token by client credentials with the Twitch Credentials, caches it in memory with its expiry, and uses it only to create, list, and delete Event Subscriptions. It never appears in any response and is not stored.
- Every Helix call on the Broadcaster's behalf, meaning reward create and update, redemption update, chat send, and Get Streams, uses the token from `getAccessToken` on the Twitch Connection. Every Spotify call uses `getAccessToken` on the Spotify Connection. A Not Configured or Reauthorization Required error from Spotify is the SpotifyUnavailable outcome. The same error from Twitch triggers the hold in story 21.
- `reconcile` runs, in order: settle held Redemptions by cancelling them; create the Reward if no stored reward ID exists and no reward with the title is manageable by this client ID, else update the existing one so its settings match the spec; delete every Event Subscription this client ID owns and create the three afresh; seed `ChannelState` from Get Streams; set the Reward's pause state from `ChannelState`. Rewards other than the deployment's are never read for a reason other than the title fallback and never written.
- `reconcile` is triggered by the API Worker after a successful Twitch authorization, and by the Channel itself when it starts and its stored Reward settings differ from the spec's constants. Both paths run the same Effect under a semaphore shared with Redemption processing.
- `receive` takes a verified notification. A stream online or offline event sets `ChannelState` and updates the Reward's pause state on Twitch. A redemption add event whose reward ID is the Reward's is appended to a stored processing queue, and the call returns as soon as the append is durable. Any other notification is discarded without a write.
- The Channel drains its processing queue one Redemption at a time in arrival order, on the same object. Processing a Redemption: if `ChannelState` is Offline, cancel with Offline. Parse the input; on failure cancel with NotATrackLink. Ask the Spotify Connection for a token; on Not Configured or Reauthorization Required cancel with SpotifyUnavailable. Add the track to the queue; on Spotify's no-active-device error cancel with NothingPlaying, on any other failure cancel with Failed. Look up the track's name and artists; on failure use the link text in the reply. Fulfil the Redemption; on failure retry three times with short waits, then log and stop without cancelling. Send the chat reply; on any failure log and stop.
- A cancellation that cannot reach Twitch because the Twitch Connection is Not Configured or Reauthorization Required stores the Redemption as held and moves on. Held Redemptions are settled only by the next `reconcile`.
- Message IDs of processed notifications are stored with their receipt time and pruned after 24 hours; `receive` returns immediately for a repeat.
- Chat replies, each addressed to the viewer by display name and kept under Twitch's 500-character limit:
  - Fulfilled: "@viewer added Track Name by Artist to the queue."
  - NotATrackLink: "@viewer that isn't a Spotify track link, points refunded."
  - NothingPlaying: "@viewer Spotify isn't playing right now, points refunded."
  - Offline: "@viewer song requests are off while the stream is offline, points refunded."
  - SpotifyUnavailable and Failed: "@viewer couldn't add that track, points refunded."
  - Chat sends set `sender_id` and `broadcaster_id` to the Twitch Connected Account's ID. A response with `is_sent` false is logged with its drop reason.

### The receiver

- The Worker answers `POST /eventsub/twitch` and nothing else. Every other path or method gets a 404 with an empty body.
- Before reading the body it refuses requests with a `Content-Length` over 16 KB with a 413. Twitch's own example redemption notification is 1.3 KB minified, and the fields that grow (viewer input, a 45-character title, a 200-character prompt, display names) cannot approach the limit.
- It computes HMAC-SHA256 with the configured secret over the message ID header, the timestamp header, and the raw body, compares it to the signature header in constant time, and answers 403 on mismatch or on a missing header.
- It answers 403 when the timestamp header is older than ten minutes by its own clock.
- On `webhook_callback_verification` it responds 200 with the raw challenge as `text/plain`.
- On `revocation` it forwards the subscription and reason to the Channel and responds 2xx.
- On `notification` it checks that the subscription type is one of the three, forwards the parsed event to the Channel's `receive`, and responds 2xx once `receive` returns. A notification of any other type gets a 2xx without reaching the Channel.
- The secret is `TWITCH_EVENTSUB_SECRET`, read as `Config.Redacted` in the Worker init like the Provider Credentials, and is the same value the Channel supplies as the transport secret when creating Event Subscriptions. The Channel reads it from its own bindings.
- The Worker has `workersDev: false`. A Cloudflare rate-limiting rule on the route is wanted; the ticket for the receiver decides whether Alchemy makes the resource cheap enough to include, and records the answer.

### Local development

- Under `alchemy dev` the receiver listens on its own strict port next to the API Worker's 1337, with the same `.env` supplying `TWITCH_EVENTSUB_SECRET`. The Twitch CLI's `event verify-subscription` and `event trigger` commands, given that secret, drive it end to end against the local Channel object.
- No production Event Subscription is ever pointed at a local receiver. Reconcile under `alchemy dev` creates Event Subscriptions only when explicitly asked, which the local run does not do.

## Testing decisions

A good test drives the system from the outside and asserts on observable results: the receiver's response, what the fake Twitch and Spotify endpoints received, and what a later notification observes. Tests never inspect internal state, never mock modules, and substitute behavior only by providing a different Effect layer.

- Primary surface: HTTP requests through the receiver's fetch handler with bodies signed by the test using the configured secret. This covers the 404 catch-all, the size limit, signature and timestamp rejection, the challenge, revocation, duplicate suppression, and the full Song Request path through to the fake Twitch and Spotify endpoints.
- Three substitutions make that run without workerd:
  1. The existing closed fake `HttpClient`, extended with Helix endpoints for rewards, redemptions, chat, streams, EventSub subscriptions, and the client-credentials token, and Spotify endpoints for add-to-queue and get-track. Scenarios include: track queued, no active device, track not found, Spotify Connection Reauthorization Required, Twitch Connection Reauthorization Required, fulfil failing once then succeeding, fulfil failing every time, chat dropped, and each stream event.
  2. `SqlClient` from the Node SQLite adapter package over an in-memory database, running the real Channel store.
  3. The Channel object and both Connection objects constructed in-process over substitutions 1 and 2, with the Worker-side services provided from them.
- Behavior with no HTTP trigger is tested by invoking the Channel's methods directly under Effect's `TestClock`: reconcile creating versus updating the Reward, reconcile replacing Event Subscriptions, settlement of held Redemptions, the pause state following Live and Offline, message ID pruning at 24 hours, the fulfil retry waits, and serial processing order under a burst of notifications.
- The Song Request input parser is tested as a pure function over a table of accepted and refused inputs.
- Modules under test: the receiver's routes, the Channel object's methods, the Channel store, the reconcile, the Redemption processing, the input parser, and the new Helix and Spotify clients. `SqlClient` adapters are not tested.
- No workerd-backed tier. Route precedence over the custom domain, the real challenge handshake, and Access not covering the receiver are verified in production by an end-to-end verification ticket in the shape of ticket 09 of the OAuth work.

## Out of scope

- Any Reward other than Song Request, and automatic rewards such as highlighted messages.
- Rewards the Broadcaster made in the Twitch dashboard or another app created.
- The `channel.channel_points_custom_reward_redemption.update` Event Subscription; the deployment causes every status change itself.
- Showing Reward, Event Subscription, or Live state on the Broadcaster Page.
- Pausing the Reward for any reason other than Offline, including Spotify being disconnected.
- Per-user or per-stream limits and cooldowns on the Reward.
- Retrying a failed Song Request instead of refunding it.
- Resolving album, playlist, artist, or episode links to a track.
- An on-stream overlay; chat is the on-stream feedback.
- The WebSocket and Conduit EventSub transports.
- Spotify's auxiliary client token.

## Further notes

- Only the app that created a reward may update the reward or its redemptions, and Twitch's redemption update call succeeds only while the redemption is unfulfilled. Both facts drive the ownership rule and the hold in story 21. See `docs/research/twitch-eventsub-channel-points.md`.
- Webhook subscriptions must be created with an app access token even though the redemption types require the Broadcaster's scopes; the scopes are checked against the client ID. The Twitch Connection's granted scopes already include manage redemptions and write chat.
- Twitch documents the response deadline only as "a few seconds" and does not publish retry counts or source IP ranges, which is why the receiver records then acknowledges and why a rate limit rather than an allowlist is the extra guard.
- Deleting the Reward would fulfil every open Redemption, so the reconcile updates in place and never deletes.
- Cloudflare Access stays as ADR 0002 describes: Worker-scoped, both existing Workers enrolled. The receiver is simply a third Worker that never enrolls. The 403 backstop on the API Worker is unchanged.
- The stack has only ever been deployed under the `production` stage, and the stage-name guard from OAuth ticket 10 still applies.
