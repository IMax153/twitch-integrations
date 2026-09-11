# 01: Write the spec for the first Connection consumer

**What to build:** A spec for the first feature that acts on the Broadcaster's behalf through a Connection, so the OAuth work has a consumer. The candidate is Twitch channel point redemptions over EventSub: the granted scopes already cover reading and managing redemptions and chat, and `getAccessToken` on the Connections service hands out a valid token without the consumer touching OAuth.

**Blocked by:** None

**Status:** needs-triage

- [ ] Decide what the deployment does with a redemption (the stream-side behaviour the Broadcaster wants)
- [ ] Choose the EventSub transport; a public webhook needs its own Worker or hostname, since Access covers both current Workers entirely (ADR 0002)
- [ ] Decide how stream online and offline state gates behaviour, which the OAuth spec left out of scope
- [ ] Write `.scratch/twitch-channel-point-redemptions/spec.md` with user stories, implementation decisions, and testing decisions in the shape of the OAuth spec

## Comments

Raised on 2026-09-11 when ticket 09 of the OAuth feature closed. The consumer starts from the Connections service and never handles tokens or refresh itself.
