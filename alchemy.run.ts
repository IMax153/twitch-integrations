import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

import ApiWorker from "@twitch-integrations/api/Worker"
import { CloudflareAccess, BroadcasterAccess } from "@twitch-integrations/infra/Access"
import { WebSite } from "@twitch-integrations/infra/Web"

export default Alchemy.Stack(
  "TwitchIntegrations",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const access = yield* CloudflareAccess
    const provideAccess = Effect.provideService(BroadcasterAccess, access)

    const apiWorker = yield* ApiWorker.pipe(provideAccess)
    yield* WebSite.pipe(provideAccess)

    return {
      accessApplicationId: access.applicationId,
      apiUrl: apiWorker.url,
    }
  }),
)
