import { OperatorAccess, devOperatorAccess } from "@twitch-integrations/infra/Access"
import { operatorHostname, operatorRoute, zoneName } from "@twitch-integrations/infra/Domain"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { Connections } from "./Connections.ts"
import { OperatorHttp } from "./OperatorRoutes.ts"

/** The port the API Worker listens on under `alchemy dev`; the web dev server proxies to it. */
const devPort = 1337

/**
 * The API Worker owns the operator hostname as its custom domain, so every
 * path not routed to another Worker lands here. The `/setup/api*` route is
 * more specific than the web Worker's `/setup*` route, so the page's JSON
 * requests reach this Worker.
 */
export default class ApiWorker extends Cloudflare.Worker<ApiWorker>()(
  "Worker",
  Effect.gen(function* () {
    const access = yield* OperatorAccess
    return {
      main: import.meta.url,
      domain: { name: operatorHostname, zoneName },
      routes: [operatorRoute("/setup/api*")],
      access,
      workersDev: false,
      dev: { port: devPort, access: devOperatorAccess },
    }
  }),
  Effect.gen(function* () {
    const fetch = yield* OperatorHttp.pipe(Effect.provide(Connections.live))
    return { fetch }
  }),
) {}
