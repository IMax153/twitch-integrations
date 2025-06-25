import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { Config, Effect, Layer } from "effect"
import { createServer } from "node:http"
import { ApiV1 } from "./api.js"
import { TwitchHttpLayer } from "./twitch/http.js"

const ApiLayer = Layer.provide(HttpApiBuilder.api(ApiV1), [
  TwitchHttpLayer
])

export const HttpLayer = Effect.gen(function*() {
  const listenAddress = yield* Config.string("APPLICATION_LISTEN_HOST").pipe(
    Config.withDefault("127.0.0.1")
  )
  const listenPort = yield* Config.port("APPLICATION_LISTEN_PORT").pipe(
    Config.withDefault(8080)
  )
  return HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
    Layer.provide(HttpApiBuilder.middlewareCors()),
    Layer.provide(ApiLayer),
    HttpServer.withLogAddress,
    Layer.provide(NodeHttpServer.layer(createServer, {
      host: listenAddress,
      port: listenPort
    }))
  )
}).pipe(Layer.unwrapEffect)
