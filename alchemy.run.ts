import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

import ApiWorker from "@twitch-integrations/api/Worker"
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

    const apiWorker = yield* ApiWorker.pipe(provideAccess)
    yield* WebSite.pipe(provideAccess)
    // The receiver is public on purpose and takes no Access enrollment.
    yield* EventSubWorker

    return {
      accessApplicationId: access?.applicationId,
      apiUrl: apiWorker.url,
    }
  }),
)
