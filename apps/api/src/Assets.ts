import * as Cloudflare from "alchemy/Cloudflare"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * The Operator Page build shipped as the Worker's static assets. Paths are
 * relative to the assets directory root, not to the `/setup` prefix the page
 * is served under. A missing file resolves to a 404 response.
 */
export class Assets extends Context.Service<
  Assets,
  { readonly fetch: (path: string) => Effect.Effect<Response> }
>()("@twitch-integrations/api/Assets") {}

interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

export const makeAssets = Effect.gen(function* () {
  const env = yield* Cloudflare.WorkerEnvironment
  return Assets.of({
    fetch: (path) =>
      Effect.promise(() => {
        const binding = env.ASSETS as AssetsBinding
        return binding.fetch(new Request(new URL(path, "https://assets.invalid")))
      }),
  })
})

export const AssetsLive = Layer.effect(Assets, makeAssets)
