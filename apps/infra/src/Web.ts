import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { OperatorAccess } from "./Access.ts"
import { operatorRoute } from "./Domain.ts"

/**
 * The Operator Page: the Foldkit app in `apps/web`, built by Vite under the
 * `/setup/` base and served as an assets-only Worker on the `/setup*` route.
 */
export const WebSite = Effect.gen(function* () {
  const access = yield* OperatorAccess
  return yield* Cloudflare.Website.Foldkit("Web", {
    rootDir: "apps/web",
    routes: [operatorRoute("/setup*")],
    access,
    workersDev: false,
  })
})
