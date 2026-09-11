import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { BroadcasterAccess } from "./Access.ts"
import { broadcasterRoute } from "./Domain.ts"

/**
 * The Broadcaster Page: the Foldkit app in `apps/web`, built by Vite under the
 * `/setup/` base and served as an assets-only Worker on the `/setup*` route.
 */
export const WebSite = Effect.gen(function* () {
  const access = yield* BroadcasterAccess
  return yield* Cloudflare.Website.Foldkit("Web", {
    rootDir: "apps/web",
    routes: [broadcasterRoute("/setup*")],
    access,
    workersDev: false,
  })
})
