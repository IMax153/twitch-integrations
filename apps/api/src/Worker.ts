import * as Cloudflare from "alchemy/Cloudflare"
import * as Command from "alchemy/Command"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import { Assets, makeAssets } from "./Assets.ts"
import { OperatorHttp } from "./OperatorRoutes.ts"

/** The fixed Access `user_uuid` the simulated Operator carries under `alchemy dev`. */
const devOperatorUserUuid = "00000000-0000-4000-8000-000000000001"

export default class ApiWorker extends Cloudflare.Worker<ApiWorker>()(
  "Worker",
  Effect.gen(function* () {
    const webBuild = yield* Command.Build("WebBuild", {
      cwd: "apps/web",
      command: "vp build",
      outdir: "dist/client",
    })
    return {
      main: import.meta.url,
      assets: {
        directory: webBuild.outdir,
        hash: webBuild.hash.output,
        htmlHandling: "none" as const,
        notFoundHandling: "none" as const,
        runWorkerFirst: true,
      },
      dev: {
        access: {
          aud: "dev",
          identity: {
            email: Config.String("TWITCH_CHANNEL_OWNER_EMAIL"),
            user_uuid: devOperatorUserUuid,
          },
        },
      },
    }
  }),
  Effect.gen(function* () {
    const assets = yield* makeAssets
    const handler = yield* OperatorHttp
    return { fetch: handler.pipe(Effect.provideService(Assets, assets)) }
  }),
) {}
