import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { Channel } from "@twitch-integrations/api/Channel"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { type BroadcasterWorld, makeWorld } from "../../api/test/BroadcasterHarness.ts"
import { OverlayHttp } from "../src/OverlayRoutes.ts"

/** The Broadcaster's world with the overlay Worker's handler in front of its Channel object. */
export interface OverlayWorld extends BroadcasterWorld {
  /** Answers one Web request as the overlay Worker would. */
  readonly serve: (request: Request) => Effect.Effect<Response>
}

export const makeOverlayWorld: Effect.Effect<OverlayWorld, never, Scope.Scope> = Effect.gen(
  function* () {
    const world = yield* makeWorld()
    const handler = yield* OverlayHttp.pipe(
      Effect.provide(
        Layer.merge(
          NodeCrypto.layer,
          Layer.succeed(
            Channel,
            Channel.fromObject(() => world.channel),
          ),
        ),
      ),
    )
    const serve: OverlayWorld["serve"] = (request) =>
      handler.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(request),
        ),
        Effect.scoped,
        Effect.map(HttpServerResponse.toWeb),
      )
    return { ...world, serve }
  },
)
