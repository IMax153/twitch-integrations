import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"

export default Cloudflare.Worker(
  "Worker",
  {
    main: import.meta.url,
  },
  Effect.gen(function* () {
    return {
      fetch: Effect.gen(function* () {
        const access = yield* Cloudflare.Access.Context

        if (access === undefined) {
          return HttpServerResponse.text("Access required", { status: 403 })
        }

        return HttpServerResponse.text("Hello, world!")
      }),
    }
  }),
)
