import { eventSubCallbackUrl } from "@twitch-integrations/infra/Domain"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"
import { ALCHEMY_DEV } from "alchemy"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Redacted from "effect/Redacted"

export interface EventSubTransportService {
  /** The receiver's URL, which every Event Subscription names as its callback. */
  readonly callback: string
  /** The webhook secret, supplied as the transport secret so the receiver can verify signatures. */
  readonly secret: Redacted.Redacted<string>
  /**
   * Whether reconcile touches Event Subscriptions at all. False under
   * `alchemy dev`: one Twitch application serves local and production, so a
   * local reconcile would otherwise replace production's Event Subscriptions
   * with ones pointed at a receiver Twitch cannot reach.
   */
  readonly enabled: boolean
}

/**
 * Both values come from the bound environment: the secret is the same
 * Credential the receiver reads, and `ALCHEMY_DEV` is bound onto the Worker
 * when its init reads it under `alchemy dev`. A miss is a deployment defect.
 */
const make = Effect.gen(function* () {
  const secret = yield* WebhookSecret.config
  const dev = yield* ALCHEMY_DEV
  return EventSubTransport.of({ callback: eventSubCallbackUrl, secret, enabled: !dev })
}).pipe(Effect.orDie)

/** How the Channel asks Twitch to deliver notifications, and whether it asks at all. */
export class EventSubTransport extends Context.Service<
  EventSubTransport,
  EventSubTransportService
>()("@twitch-integrations/api/EventSubTransport") {
  static readonly layer: Layer.Layer<EventSubTransport> = Layer.effect(EventSubTransport)(make)
}
