import { Channel } from "@twitch-integrations/api/Channel"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import type * as Scope from "effect/Scope"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import {
  type BroadcasterWorld,
  makeWorld,
  testTransport,
} from "../../api/test/BroadcasterHarness.ts"
import { EventSubHttp } from "../src/EventSubRoutes.ts"

/**
 * The Broadcaster's world with the receiver in front of its Channel object:
 * the receiver's handler, configured with the secret the Channel hands
 * Twitch as the transport secret, delivering to the in-process object.
 */
export interface ReceiverWorld extends BroadcasterWorld {
  /** Answers one Web request as the receiver Worker would. */
  readonly receive: (request: Request) => Effect.Effect<Response>
}

export const makeReceiverWorld: Effect.Effect<ReceiverWorld, never, Scope.Scope> = Effect.gen(
  function* () {
    const world = yield* makeWorld()
    const handler = yield* EventSubHttp.pipe(
      Effect.provide(
        Layer.merge(
          Layer.succeed(WebhookSecret, Redacted.make(testTransport.secret)),
          Layer.succeed(
            Channel,
            Channel.fromObject(() => world.channel),
          ),
        ),
      ),
    )
    const receive: ReceiverWorld["receive"] = (request) =>
      handler.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(request),
        ),
        Effect.scoped,
        Effect.map(HttpServerResponse.toWeb),
      )
    return { ...world, receive }
  },
)
