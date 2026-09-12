import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { enrollment } from "./Access.ts"
import { broadcasterRoute, devHost } from "./Domain.ts"

/**
 * The port the Broadcaster Page's Vite dev server listens on under
 * `alchemy dev`. Every Worker defaults to 1337, which the API Worker owns;
 * pinning this one keeps the page's proxy to the API Worker pointed at the
 * right process.
 */
const devPort = 5173

/**
 * The Broadcaster Page: the Foldkit app in `apps/web`, built by Vite under the
 * `/` base and served as an assets-only Worker on the `/*` route. More
 * specific API, OAuth, and EventSub routes take precedence.
 */
export const WebSite = Effect.gen(function* () {
  return yield* Cloudflare.Website.Foldkit("Web", {
    rootDir: "apps/web",
    routes: [broadcasterRoute("/*")],
    ...(yield* enrollment),
    workersDev: false,
    dev: { host: devHost, port: devPort },
  })
})
