import { devBroadcasterAccess, enrollment } from "@twitch-integrations/infra/Access"
import {
  broadcasterHostname,
  broadcasterRoute,
  devHost,
  zoneName,
} from "@twitch-integrations/infra/Domain"
import { observed } from "@twitch-integrations/infra/Failure"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"
import { ALCHEMY_DEV } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Channel } from "./Channel.ts"
import { ChannelObject } from "./ChannelObject.ts"
import { Connections } from "./Connections.ts"
import { BroadcasterHttp } from "./BroadcasterRoutes.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"

/**
 * The port the API Worker listens on under `alchemy dev`; the web dev server
 * proxies to it. The port is strict so a collision fails at startup rather
 * than silently moving the Worker away from the proxy target.
 */
const devPort = 1337

/**
 * The API Worker owns the broadcaster hostname as its custom domain, so every
 * path not routed to another Worker lands here. The `/setup/api*` and
 * `/oauth*` routes are more specific than the web Worker's `/*` route, so
 * JSON and authorization requests reach this Worker. It hosts the Channel object and declares so,
 * which is what lets the receiver bind that object's namespace across
 * scripts; the class is the Worker's identity and `layer` below is its
 * implementation, which only the stack builds.
 */
export class ApiWorker extends Cloudflare.Worker<ApiWorker, {}, ChannelObject>()("Worker") {}

export default ApiWorker.make(
  Effect.gen(function* () {
    return {
      main: import.meta.url,
      domain: { name: broadcasterHostname, zoneName },
      routes: [broadcasterRoute("/setup/api*"), broadcasterRoute("/oauth*")],
      ...(yield* enrollment),
      workersDev: false,
      dev: { host: devHost, port: devPort, strictPort: true, access: devBroadcasterAccess },
    }
  }),
  Effect.gen(function* () {
    // Alchemy intercepts Config reads in this Effect, not in the props above:
    // at plan time each read is bound onto the Worker as a secret, and at
    // runtime it resolves from that binding. The Connection object reads the
    // same names from the bound environment when it starts.
    yield* observed(ProviderCredentials.config)
    // The Channel object reads both from the same bound environment: the
    // webhook secret as the Event Subscriptions' transport secret, and
    // `ALCHEMY_DEV`, which is only ever set under `alchemy dev` and is bound
    // by this read so the object can tell it must not touch Event
    // Subscriptions. Under a deploy it is unset, so nothing is bound and the
    // object reads its default.
    yield* observed(WebhookSecret.config)
    yield* observed(ALCHEMY_DEV)
    // The Worker's init is its entry point.
    const fetch = yield* BroadcasterHttp.pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(
        Layer.merge(Connections.layer, Channel.layer.pipe(Layer.provide(ChannelObject.layer))),
      ),
    )
    return { fetch: observed(fetch) }
  }),
)
