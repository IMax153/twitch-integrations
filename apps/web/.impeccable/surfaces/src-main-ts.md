---
version: 1
slug: "src-main-ts"
primary_target: "src/main.ts"
related_targets: ["src/styles.css"]
---

# Broadcaster Page monitoring

Mode: Operate. Target: `src/main.ts`, `src/styles.css`, `/`.

The confirmed task is one glanceable overview of Song Request readiness, current processing, and both Connections on a second screen or tablet. Details expand inline. Only monitoring, authorization, and refresh actions are included. No Reward editing, manual refunds, or completed history.

## Direction contract

THESIS: Extend the Connections page so stream status, processing, and authorization can be read together. Preserve the simple section-based interface; avoid a separate navigation shell or analytics dashboard.

OWN-WORLD: Inherit system-ui typography, system light/dark preference, neutral grounds, thin borders, and modest rounded corners. Semantic color reinforces written states. No new brand, imagery, or display font.

STORY: Scan the overview, identify a blocker, expand its details, and reconnect a Provider when needed. Held Redemptions explain that refunds await cancellation.

FIRST VIEWPORT: A compact title and Refresh control above Song Requests, Processing, and Connections summaries. Wide screens place these side by side; portrait tablets stack compact summaries before details. Status text leads, technical data follows.

FORM: Existing-surface extension. No concept seed applies; the confirmed brief and incumbent implementation are the visual authority. Native disclosure state survives refresh and keyed list updates.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Data and behavior

Read stored Channel observations through an authenticated endpoint. Return exact totals and the oldest 50 Processing Queue and Held Redemption entries, with explicit truncation copy. Readiness checks Channel state, Reward presence/pause state, all required Event Subscriptions, account authorization, expiry, and necessary scopes. No-observed-blockers is not a playback guarantee. Unknown or stale data cannot show current readiness.

Refresh visible-page data every 10 seconds; pause requests when hidden and refresh on return. Mark observations stale after 30 seconds without a successful check. Bound requests to 8 seconds. Keep successful data through partial failures and retain focus and disclosure state. Show empty, loading, error, stale, unconfigured, and long-content states explicitly.
