import { eventSubRoutePrefix } from "@twitch-integrations/infra/Domain"
import { BroadcasterZone } from "@twitch-integrations/infra/Zone"
import { ALCHEMY_DEV } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

/**
 * Requests one source IP may send to the receiver's route in one counting
 * period before Cloudflare blocks that IP for the mitigation timeout.
 *
 * Twitch delivers one webhook message per Redemption, retry, revocation, or
 * verification, from more than one IP, and a single channel's Redemptions
 * arrive at a few per minute even on a busy stream. A hundred in ten seconds
 * from one address is beyond what one channel can produce, so the rule only
 * ever fires on a flood, and the cost of a false positive is ten seconds of
 * refusals to one address that Twitch then retries.
 */
const requestsPerPeriod = 100

/**
 * The counting period and mitigation timeout, in seconds. The zone is on
 * Cloudflare's Free plan, which fixes both at ten seconds, counts by source
 * IP only, matches on the request path only, and allows one rule.
 */
const freePlanSeconds = 10

/**
 * The zone rate-limiting rule on the receiver's route: the one guard the
 * public route has against a flood, since Twitch publishes no source IP
 * ranges to allowlist. It runs at Cloudflare's edge, before the Worker is
 * invoked, so a flood costs no Worker requests. Nothing under `alchemy dev`,
 * where the Workers run locally and the production zone must not be touched.
 *
 * The Free plan's rule expression can name only the path, so the rule
 * covers the receiver's path prefix on every hostname in the zone; the
 * receiver is the only thing on that path. The resource owns the zone's whole
 * `http_ratelimit` phase, which on the Free plan holds this one rule.
 */
export const EventSubRateLimit = Effect.gen(function* () {
  if (yield* ALCHEMY_DEV) {
    return undefined
  }
  const zone = yield* BroadcasterZone
  return yield* Cloudflare.Ruleset.Ruleset("EventSubRateLimit", {
    zone,
    phase: "http_ratelimit",
    description: "Rate limit on the EventSub receiver's route",
    rules: [
      {
        ref: "eventsub-receiver",
        description: "Block a source IP that floods the EventSub receiver",
        expression: `starts_with(http.request.uri.path, "${eventSubRoutePrefix}")`,
        action: "block",
        ratelimit: {
          characteristics: ["ip.src"],
          period: freePlanSeconds,
          requestsPerPeriod,
          mitigationTimeout: freePlanSeconds,
        },
      },
    ],
  })
})
