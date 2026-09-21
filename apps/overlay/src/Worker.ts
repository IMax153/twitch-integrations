import { Channel, channelName } from "@twitch-integrations/api/Channel"
import { ChannelObject } from "@twitch-integrations/api/ChannelObject"
import * as WebCrypto from "@twitch-integrations/api/WebCrypto"
import { ApiWorker } from "@twitch-integrations/api/Worker"
import { broadcasterRoute, devHost, overlayRoutePrefix } from "@twitch-integrations/infra/Domain"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { OverlayHttp } from "./OverlayRoutes.ts"

/**
 * The port the overlay Worker listens on under `alchemy dev`, next to the
 * API Worker's 1337 and the receiver's 1338; the web dev server proxies
 * `/overlay` to it. Strict, so a collision fails at startup rather than
 * moving the Worker away from the proxy target.
 */
const devPort = 1339

/**
 * The Channel object's namespace as the API Worker hosts it, bound across
 * scripts, exactly as the receiver binds it: this Worker holds nothing of
 * the object's implementation.
 */
const channelLayer = Layer.effect(Channel)(
  Effect.map(ChannelObject.from(ApiWorker), (objects) =>
    Channel.fromObject(() => objects.getByName(channelName)),
  ),
)

/**
 * The overlay Worker: the second public Worker, on the `/overlay*` route of
 * the shared hostname, which OBS loads as a browser source. It never
 * enrolls in the Access application, since a browser source cannot hold an
 * Access session; the Overlay Key in the URL is its whole gate, checked by
 * the Channel object. Its configuration is the Channel object's namespace
 * alone: no Provider Credentials, no secrets, and no workers.dev URL.
 */
export default class OverlayWorker extends Cloudflare.Worker<OverlayWorker>()(
  "Overlay",
  Effect.succeed({
    main: import.meta.url,
    routes: [broadcasterRoute(`${overlayRoutePrefix}*`)],
    workersDev: false,
    dev: { host: devHost, port: devPort, strictPort: true },
  }),
  Effect.gen(function* () {
    // The Worker's init is its entry point.
    const fetch = yield* OverlayHttp.pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(Layer.merge(WebCrypto.layer, channelLayer)),
    )
    return { fetch: observed(fetch) }
  }),
) {}
