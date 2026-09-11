import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

import ApiWorker from "@twitch-integrations/api/Worker"
import { CloudflareAccess } from "@twitch-integrations/infra/Access"

export default Alchemy.Stack(
  "TwitchIntegrations",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const apiWorker = yield* ApiWorker

    const access = yield* CloudflareAccess.pipe(
      Effect.provideService(Cloudflare.Worker.Self, apiWorker),
    )

    return {
      accessApplicationId: access.applicationId,
      apiUrl: apiWorker.url,
    }
  }),
)
