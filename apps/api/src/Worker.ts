import { devBroadcasterAccess, enrollment } from "@twitch-integrations/infra/Access"
import {
  broadcasterHostname,
  broadcasterRoute,
  devHost,
  zoneName,
} from "@twitch-integrations/infra/Domain"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
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
 * path not routed to another Worker lands here. The `/setup/api*` route is
 * more specific than the web Worker's `/setup*` route, so the page's JSON
 * requests reach this Worker.
 */
export default class ApiWorker extends Cloudflare.Worker<ApiWorker>()(
  "Worker",
  Effect.gen(function* () {
    // Yielding the Credentials here registers them as this Worker's secrets;
    // the Connection object reads the bound values when it starts.
    yield* ProviderCredentials.config
    return {
      main: import.meta.url,
      domain: { name: broadcasterHostname, zoneName },
      routes: [broadcasterRoute("/setup/api*")],
      ...(yield* enrollment),
      workersDev: false,
      dev: { host: devHost, port: devPort, strictPort: true, access: devBroadcasterAccess },
    }
  }),
  Effect.gen(function* () {
    const fetch = yield* BroadcasterHttp.pipe(Effect.provide(Connections.layer))
    return { fetch }
  }),
) {}
