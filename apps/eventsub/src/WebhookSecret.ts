import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Redacted from "effect/Redacted"

const config = Config.Redacted("TWITCH_EVENTSUB_SECRET")

/** Config resolution cannot fail once the secret is bound, so a miss is a deployment defect. */
const make = Effect.orDie(config)

/**
 * The secret Twitch signs every webhook message with. The Worker's runtime
 * Effect yields `config` so Alchemy registers the value as a Worker secret
 * at plan time; `layer` reads the same name from the bound environment at
 * runtime. The Channel supplies the same value as the transport secret when
 * it creates Event Subscriptions, read from its own bindings.
 */
export class WebhookSecret extends Context.Service<WebhookSecret, Redacted.Redacted<string>>()(
  "@twitch-integrations/eventsub/WebhookSecret",
) {
  static readonly config = config
  static readonly layer = Layer.effect(WebhookSecret)(make)
}
