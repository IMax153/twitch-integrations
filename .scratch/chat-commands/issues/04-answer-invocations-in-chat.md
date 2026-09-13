# 04: The Channel reads chat and answers Invocations

**What to build:** The Twitch scope list gains `user:bot` and `channel:bot`. `EventSubscriptionType` gains `channel.chat.message`; the reconcile requests it with `broadcaster_user_id` and `user_id` both set to the Connected Account, but only when the Twitch Connection's granted scopes include all required chat scopes, logging a skip otherwise. The receiver decodes the chat payload into a `ChatMessage` event with the message ID, chatter identity, text, and optional source broadcaster ID. `ChannelReceive` handles it under the lock: ignore without a write when the source broadcaster is another channel, nothing matches, the match is Disabled, or the match is in Cooldown; otherwise stamp `cooldownUntil` and `lastAnsweredAt`, record the message ID, and after releasing the lock send one threaded reply via Helix with `reply_parent_message_id`. A missing token or `is_sent` false is logged and clears `cooldownUntil`. Live and Offline are not consulted.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Twitch scopes include `user:bot` and `channel:bot`; the reconcile creates the chat Event Subscription only with the scopes present, and the fake EventSub endpoint shows which were requested in each case
- [ ] The receiver decodes `channel.chat.message` and hands it to the Channel; an unknown type is still acknowledged without reaching the Channel
- [ ] Driving the signed receiver end to end: an exact `!today` gets a threaded reply at the fake chat endpoint; `!Today`, a Disabled command, a command in Cooldown, and a shared chat source get nothing and store nothing
- [ ] A resend of an answered message ID is acknowledged and not answered again
- [ ] A drop with `is_sent` false and a Twitch Connection that is Reauthorization Required are logged and leave no Cooldown, so the next Invocation is answered
- [ ] The README records the Twitch CLI command that triggers a chat message against the local receiver
- [ ] `docs/research/twitch-chat-message-eventsub.md` is cited where the scope rule is enforced

## Comments
