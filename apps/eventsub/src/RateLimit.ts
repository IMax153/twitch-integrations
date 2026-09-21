import { eventSubRoutePrefix, overlayRoutePrefix } from "@twitch-integrations/infra/Domain"
import { BroadcasterZone } from "@twitch-integrations/infra/Zone"
import { ALCHEMY_DEV } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

/**
 * Requests one source IP may send to the receiver's route in one counting
 * period before Cloudflare blocks that IP for the mitigation timeout. The
 * counter is kept per colocation, so a flood spread across Cloudflare's
 * data centres is counted at each one separately.
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
 * What the counter is keyed by. Cloudflare rejects a rule keyed by source
 * IP alone: rate limiting is counted per colocation, so `cf.colo.id` must
 * be named alongside every other characteristic.
 */
const characteristics = ["cf.colo.id", "ip.src"]

/**
 * The zone rate-limiting rule on the public routes: the one guard the
 * receiver's route has against a flood, since Twitch publishes no source IP
 * ranges to allowlist, and the overlay Worker's route beside it, whose
 * only caller is the Broadcaster's OBS polling every few seconds. It runs
 * at Cloudflare's edge, before either Worker is invoked, so a flood costs
 * no Worker requests. Nothing under `alchemy dev`, where the Workers run
 * locally and the production zone must not be touched.
 *
 * The Free plan's rule expression can name only the path, so the rule
 * covers both path prefixes on every hostname in the zone; those Workers
 * are the only things on those paths. The resource owns the zone's whole
 * `http_ratelimit` phase, which on the Free plan holds this one rule, so
 * both prefixes share it. The logical id keeps its EventSub name on purpose:
 * renaming it would replace the deployed rule.
 */
export const EventSubRateLimit = Effect.gen(function* () {
  if (yield* ALCHEMY_DEV) {
    return undefined
  }
  const zone = yield* BroadcasterZone
  return yield* Cloudflare.Ruleset.Ruleset("EventSubRateLimit", {
    zone,
    phase: "http_ratelimit",
    description: "Rate limit on the public routes: the EventSub receiver and the Overlay",
    rules: [
      {
        ref: "eventsub-receiver",
        description: "Block a source IP that floods the EventSub receiver or the Overlay",
        expression: `starts_with(http.request.uri.path, "${eventSubRoutePrefix}") or starts_with(http.request.uri.path, "${overlayRoutePrefix}")`,
        action: "block",
        ratelimit: {
          characteristics,
          period: freePlanSeconds,
          requestsPerPeriod,
          mitigationTimeout: freePlanSeconds,
        },
      },
    ],
  })
})
