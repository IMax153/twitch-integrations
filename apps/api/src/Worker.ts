import * as Cloudflare from "alchemy/Cloudflare"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import { OperatorHttp } from "./OperatorRoutes.ts"

/** The fixed Access `user_uuid` the simulated Operator carries under `alchemy dev`. */
const devOperatorUserUuid = "00000000-0000-4000-8000-000000000001"

export default Cloudflare.Worker(
  "Worker",
  {
    main: import.meta.url,
    dev: {
      access: {
        aud: "dev",
        identity: {
          email: Config.String("TWITCH_CHANNEL_OWNER_EMAIL"),
          user_uuid: devOperatorUserUuid,
        },
      },
    },
  },
  Effect.gen(function* () {
    const fetch = yield* OperatorHttp
    return { fetch }
  }),
)
