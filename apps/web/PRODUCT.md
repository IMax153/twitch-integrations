# Broadcaster Page

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The Broadcaster is the single human who streams on the connected Twitch channel and manages this deployment. Cloudflare Access restricts the Broadcaster Page to that person. Viewers interact through Twitch and never authorize their own accounts with this deployment.

## Product Purpose

Give the Broadcaster a place to check and manage the Connections and stream behavior that connect Twitch with Spotify. Success means the Broadcaster can recognize when attention is needed and take the appropriate action, including during a live stream.

The current page implements Connections authorization and monitoring of the Channel, Song Request readiness, Processing Queue, and Held Redemptions. Broader Channel and Song Request management remains future work.

## Operating Context

The Broadcaster uses the page before and during streams for checks and intervention, and when troubleshooting authorization or refresh problems. During-stream use competes with the work of broadcasting. Second-screen and tablet use are confirmed contexts; the page also adapts to mobile screens.

One deployment uses one shared Spotify account and one shared Twitch account. The Song Request Reward lets a viewer redeem channel points with a Spotify track link to add a track to the Broadcaster's Spotify queue. Rewards can be redeemed only while the Channel is Live. Offline Rewards are paused, and arriving Redemptions are cancelled.

The page is served at `/setup/` on `stream.minbadblue.com`. It shares an origin and Access session with the API. Authorization leaves the page for the Provider and returns with a result.

Local development uses `vp run dev` from the repository root. The web dev configuration uses `127.0.0.1:5173`, with `/setup/api` and `/oauth` proxied to the API Worker on port 1337.

## Capabilities and Constraints

The current Broadcaster Page:

- Lists the Spotify and Twitch Connections and their statuses: Not Configured, Authorized, or Reauthorization Required.
- Shows the Connected Account, granted scopes, expiry, next scheduled refresh, and last Refresh Error when available.
- Starts authorization or reauthorization with Connect and Reconnect actions.
- Reports authorization results and offers Refresh for monitoring and Connections data.
- Shows observed Channel state, Reward state, and Song Request readiness with reasons for observed blockers. Readiness uses stored Channel observations and Connection authorization, expiry, and permissions. It does not probe Provider health or guarantee Spotify playback.
- Shows exact snapshot counts for the Processing Queue and Held Redemptions, with detail lists bounded to the oldest 50 entries in each and explicit truncation notices.
- Explains that the Processing Queue is separate from the Spotify queue and that Held Redemptions await cancellation; their refunds are not yet confirmed.
- Refreshes automatically while visible, supports manual refresh, and reports freshness and partial failures. Successful data remains available when a subsequent check fails; stale or unavailable data cannot establish current readiness.

Pause/resume controls, Reward configuration, manual refunds, and completed history are future capabilities. Route-specific layout, refresh intervals, and review evidence belong in `.impeccable/surfaces/src-main-ts.md` and `.impeccable/review/`.

Provider Credentials are deployment configuration. Account authorization is the page's workflow. Authorization uses a native form submission to the API, followed by a Provider redirect.

Use the domain terms in `../../CONTEXT.md`. In particular, distinguish the Broadcaster from the Twitch Connected Account, a Connection from the Channel, and the Processing Queue from the Spotify queue. Cancelling a Redemption refunds the viewer's points.

The implementation uses Foldkit and Effect. The same-origin Worker routing and Access constraints are recorded in `../../docs/adr/0002-two-workers-on-one-custom-domain.md`.

## Brand Commitments

The current application title is Twitch Integrations. Broadcaster Page is the domain name for this interface. Preserve the repository's established terminology. No additional binding voice or brand commitments have been established.

## Evidence on Hand

- `../../CONTEXT.md` defines the deployment model, people, Connections, Channel, Rewards, and Song Requests.
- `src/view.ts` composes the page and authorization-result copy.
- `src/channelView.ts`, `src/connectionView.ts`, and `src/monitoringView.ts` implement monitoring, authorization controls, detail disclosures, and freshness copy.
- `src/model.ts`, `src/command.ts`, `src/subscription.ts`, and `src/main.ts` define monitoring state, requests, refresh scheduling, and updates.
- `../../packages/domain/src/SongRequestReadiness.ts` defines readiness checks; `../../packages/domain/src/ChannelMonitoring.ts` and `../api/src/ChannelStore.ts` define the bounded monitoring snapshot.
- `src/styles.css` contains the current page styling.
- `../../docs/adr/0002-two-workers-on-one-custom-domain.md` records deployment routing, Access, and local proxy behavior.

## Product Principles

- Make Song Request readiness, processing, Connection status, and the next useful action clear enough to check while broadcasting.
- Preserve the single-Broadcaster model; viewers do not need account authorization here.
- Distinguish observed readiness from playback guarantees, and implemented monitoring from planned management controls.
- Use domain terms consistently so the page and troubleshooting information describe the same concepts.

## Open Decisions

- Which Channel and Song Request controls belong on the page, and in what order they should be delivered.
- Product-specific accessibility requirements beyond the current keyboard and touch support.
- Voice and brand commitments beyond the existing name and domain terminology.
