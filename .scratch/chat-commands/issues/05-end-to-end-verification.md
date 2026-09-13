# 05: Verify Chat Commands in production

**What to build:** Nothing new. Deploy, then confirm the feature against the live channel and record the outcome here, in the shape of ticket 10 of the redemptions work.

**Blocked by:** 03, 04

**Status:** ready-for-human

- [ ] After deploy, the Chat Commands section shows the scope notice for the existing Twitch authorization
- [ ] Pressing Connect on Twitch grants `user:bot` and `channel:bot`; the notice disappears and the Channel snapshot lists four Event Subscriptions, the chat one enabled
- [ ] A `!today` Chat Command created on the page is answered in chat, as a reply to the Broadcaster's own message
- [ ] Typing it twice within the Cooldown produces one reply; editing the response and typing again produces a reply at once
- [ ] Disabling it silences it; deleting it after confirmation removes it from the page
- [ ] Song Requests still work after the re-authorization

## Comments
