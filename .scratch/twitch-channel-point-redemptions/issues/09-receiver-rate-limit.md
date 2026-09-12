# 09: Decide the rate limit on the receiver route

**What to build:** Twitch publishes no source IP ranges, so the receiver cannot allowlist and a rate limit is the remaining guard against a flood on the public route. Find out whether Alchemy can declare a Cloudflare rate-limiting rule on the `/eventsub*` route as an ordinary resource in the stack. If it can, add the rule at a threshold well above Twitch's plausible delivery rate for one channel and verify it appears in the plan. If it cannot, or needs a plan or product the zone does not have, record that outcome and the reasoning in the spec's receiver section and in the ADR 0002 amendment, so the decision is written down either way.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The Alchemy resource for a zone rate-limiting rule is identified, or its absence is established from Alchemy's source or docs
- [ ] If available, the rule is added to the stack on the receiver's route with its threshold justified in a comment, and `alchemy plan` shows it without touching other resources
- [ ] If not available, the spec and the ADR 0002 amendment record why the receiver has no rate limit and what stands in for it
- [ ] Either outcome is summarised in a comment on this ticket
