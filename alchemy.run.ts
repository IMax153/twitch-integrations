import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

import ApiWorkerLayer, { ApiWorker } from "@twitch-integrations/api/Worker"
import EventSubWorker from "@twitch-integrations/eventsub/Worker"
import { CloudflareAccess, BroadcasterAccess } from "@twitch-integrations/infra/Access"
import { guardStage } from "@twitch-integrations/infra/Stage"
import { WebSite } from "@twitch-integrations/infra/Web"

export default Alchemy.Stack(
  "TwitchIntegrations",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    yield* guardStage
    const access = yield* CloudflareAccess
    const provideAccess = Effect.provideService(BroadcasterAccess, access)

    const workers = Effect.gen(function* () {
      const apiWorker = yield* ApiWorker
      yield* WebSite
      // The receiver is public on purpose and takes no Access enrollment. It
      // binds the Channel object the API Worker hosts, which is why the API
      // Worker's layer is provided around both rather than to each.
      yield* EventSubWorker

      return {
        accessApplicationId: access?.applicationId,
        apiUrl: apiWorker.url,
      }
    })
    // The stack is the entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    return yield* workers.pipe(Effect.provide(ApiWorkerLayer), provideAccess)
  }),
)
