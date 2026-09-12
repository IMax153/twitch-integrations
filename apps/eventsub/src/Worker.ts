import { Channel, channelName } from "@twitch-integrations/api/Channel"
import { ChannelObject } from "@twitch-integrations/api/ChannelObject"
import { ApiWorker } from "@twitch-integrations/api/Worker"
import { broadcasterRoute, devHost } from "@twitch-integrations/infra/Domain"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { EventSubHttp } from "./EventSubRoutes.ts"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"

/**
 * The port the receiver listens on under `alchemy dev`, next to the API
 * Worker's 1337. Strict, so a collision fails at startup rather than moving
 * the receiver away from the address the Twitch CLI is pointed at.
 */
const devPort = 1338

/**
 * The Channel object's namespace as the API Worker hosts it, bound across
 * scripts: the receiver holds the namespace and nothing of the object's
 * implementation, so its only binding is the one it delivers to.
 */
const channelLayer = Layer.effect(Channel)(
  Effect.map(ChannelObject.from(ApiWorker), (objects) =>
    Channel.fromObject(() => objects.getByName(channelName)),
  ),
)

/**
 * The receiver: the one public Worker, on the `/eventsub*` route of the
 * shared hostname, where Twitch delivers EventSub webhook messages. It never
 * enrolls in the Access application, so Twitch reaches it without a login;
 * a route takes precedence over the API Worker's custom domain on the same
 * hostname. Its configuration is the webhook secret and the Channel object's
 * namespace: no Provider Credentials, no Connection binding, and no
 * workers.dev URL.
 */
export default class EventSubWorker extends Cloudflare.Worker<EventSubWorker>()(
  "EventSub",
  Effect.succeed({
    main: import.meta.url,
    routes: [broadcasterRoute("/eventsub*")],
    workersDev: false,
    dev: { host: devHost, port: devPort, strictPort: true },
  }),
  Effect.gen(function* () {
    // Read here, in the runtime Effect, so Alchemy binds the secret onto the
    // Worker at plan time and resolves it from that binding at runtime.
    yield* observed(WebhookSecret.config)
    // The Worker's init is its entry point.
    const fetch = yield* EventSubHttp.pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(Layer.merge(WebhookSecret.layer, channelLayer)),
    )
    return { fetch: observed(fetch) }
  }),
) {}
