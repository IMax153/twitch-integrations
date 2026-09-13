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

Agent work done on 2026-09-13 from the worktree at `bd596e2` (main after #18). Blocked: ticket 03 is still `ready-for-agent`, and no branch carries its code, so the page has no Chat Commands section, no scope notice, and no write routes. Boxes 1, 3, 4, and 5 cannot be exercised until 03 ships; boxes 2 and 6 only need ticket 04 and could be checked on a deploy of today's main, but a second deploy and reconnect would follow 03 anyway. The deploy and every box remain the Broadcaster's, so the ticket stays `ready-for-human`. What was checked read-only:

- `vp check` passes (five pre-existing lint warnings, no errors); the full suite passes, 18 files, 293 tests.
- `alchemy plan --stage production` from the worktree: 3 to update, the three Workers (`Worker`, `Web`, `EventSub`); every Access resource, the zone, the rate-limiting rule, and the Durable Object bindings are noops. The Alchemy profile points at the personal account, since the plan found state (an all-create plan would mean the matechs account again).
- Twitch CLI `api get eventsub/subscriptions` under an app token: still the three from the 2026-09-12 22:12Z reconnect (redemption add, `stream.online`, `stream.offline`), all `enabled`, callback `https://stream.minbadblue.com/eventsub/twitch`. No `channel.chat.message` entry, as expected: production runs the code from the ticket 10 deploys, before #16 through #18, so the chat scopes, the chat Event Subscription, and the reply path have never been deployed.
- Live receiver probe, anonymously with Node `fetch`: `GET /eventsub/twitch` empty 404, unsigned `POST` empty 403, and `GET /`, `/setup`, `/setup/api/connections`, `/setup/api/channel` all 302 to the Access login. Unchanged from ticket 10.
- The main checkout is at `545d4de`, two commits behind `origin/main`, and clean; `vp run deploy` from there needs a `git pull --ff-only` first or it ships without the chat code.

What the logs will say after the reconnect, for reading box 2: before the re-authorization the reconcile logs `Skipping the chat Event Subscription: the Twitch Connection lacks user:read:chat, user:bot, channel:bot` (whichever are missing) and `Replaced 3 Event Subscriptions with 3`; after it, `Replaced 3 Event Subscriptions with 4`, then four POSTs to the receiver, Twitch's challenges. An answered Invocation logs `Answered !today for <chatter>` on the EventSub Worker. The chat subscription's condition carries `broadcaster_user_id` and `user_id` both `50829826`.

Human steps, in order, once 03 has merged: `git pull --ff-only` in the main checkout; `vp run deploy` and confirm the plan is three Worker updates and noops elsewhere; rerun the anonymous probe from the README's step 4; open the Broadcaster Page and confirm the scope notice names the three chat scopes; press Connect on Twitch, complete consent, and confirm the notice is gone and the snapshot lists four Event Subscriptions with the chat one enabled (the CLI command above confirms it from Twitch's side); create `!today` on the page and type it in chat from the Broadcaster's account, expecting one threaded reply; type it again inside the Cooldown, expecting silence; edit the response and type it again, expecting the new reply at once; disable it and type it, expecting silence; delete it after the confirmation; redeem Song Request once to confirm the re-authorization kept the Reward working. Record timings and surprises below.

Update, later on 2026-09-13: ticket 03 is done on this branch, so the blocker above is gone. The deploy now ships the routes and the section along with the ticket 04 code; the plan should still be the three Worker updates. The human steps stand as written.

