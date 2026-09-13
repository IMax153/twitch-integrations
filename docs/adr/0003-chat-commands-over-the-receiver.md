---
status: accepted
---

# Chat Commands read chat through the webhook receiver and force a Twitch re-authorization

Chat Commands need every chat line delivered to the deployment so it can spot an Invocation. The two EventSub transports open to a Cloudflare deployment are the webhook receiver that already exists for Redemptions and stream state (ADR 0002), and a WebSocket held open from the Channel Durable Object. We subscribe to `channel.chat.message` over the webhook receiver: every chat line arrives as one signed POST on `/eventsub*`, is verified, and reaches the Channel through the same lock and message ID dedupe as the other three Event Subscriptions. The WebSocket transport was rejected because it would add a second transport with its own reconnect, keepalive, and subscription lifecycle for the sake of one subscription, and the Durable Object would have to stay resident to hold it.

Reading chat with an app access token over webhooks requires the Broadcaster's token to grant `user:bot` and `channel:bot` beside the `user:read:chat` it already holds. Scopes widen only on the next authorization, so this feature makes the Broadcaster press Connect on Twitch once more after it deploys, and the Twitch Event Subscription for chat cannot exist until they do.

## Consequences

- The receiver's volume is now driven by viewers rather than by the Broadcaster. The zone rate-limiting rule from ADR 0002 counts a hundred requests per source address per colocation in ten seconds; Twitch spreads deliveries across addresses and this channel's chat is nowhere near that rate, but the rule is the first thing to revisit if chat Event Subscriptions start reporting failures.
- A chat line that invokes nothing is acknowledged without a write, so chat volume cannot fill storage. The one reply an Invocation earns is the exception to acknowledging before slow work: it is one Helix call, sent after the Channel lock is released and before the receiver answers, so a resend under the same message ID can never produce a second reply.
- The reconcile skips the chat Event Subscription, and logs that it did, while the Twitch Connection lacks the bot scopes, so an older authorization keeps Song Requests working and only Chat Commands wait.
- The chat reply is sent as the Twitch Connected Account, as Song Request replies already are. There is no separate bot account.
