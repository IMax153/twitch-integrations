# 01: Write the spec for the first Connection consumer

**What to build:** A spec for the first feature that acts on the Broadcaster's behalf through a Connection, so the OAuth work has a consumer. The candidate is Twitch channel point redemptions over EventSub: the granted scopes already cover reading and managing redemptions and chat, and `getAccessToken` on the Connections service hands out a valid token without the consumer touching OAuth.

**Blocked by:** None

**Status:** ready-for-human

- [x] Decide what the deployment does with a redemption (the stream-side behaviour the Broadcaster wants)
- [x] Choose the EventSub transport; a public webhook needs its own Worker or hostname, since Access covers both current Workers entirely (ADR 0002)
- [x] Decide how stream online and offline state gates behaviour, which the OAuth spec left out of scope
- [x] Write `.scratch/twitch-channel-point-redemptions/spec.md` with user stories, implementation decisions, and testing decisions in the shape of the OAuth spec

## Comments

Raised on 2026-09-11 when ticket 09 of the OAuth feature closed. The consumer starts from the Connections service and never handles tokens or refresh itself.

Grilled on 2026-09-11 and 2026-09-12; spec written at `.scratch/twitch-channel-point-redemptions/spec.md` as a draft for the Broadcaster to read. Settled: one deployment-owned Reward, Song Request, at one point; Spotify track link in, track queued and chat reply out; every failure refunds; Offline pauses the Reward and refunds stragglers; webhook transport on a third, unenrolled Worker on the shared hostname (ADR 0002 amended); a Channel Durable Object owns the Reward, Live state, Event Subscriptions, and held Redemptions. Glossary terms added to `CONTEXT.md`: Channel, Event Subscription, Reward, Redemption, Song Request, Live, Offline. The EventSub research is copied to `docs/research/twitch-eventsub-channel-points.md`. Next: break the spec into implementation tickets and add an end-to-end verification ticket.
