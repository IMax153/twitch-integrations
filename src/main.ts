import { NodeContext, NodeHttpClient, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, Logger, LogLevel } from "effect"
import { HttpLayer } from "./http.js"
import { TwitchChatMacros } from "./services/chat-macros.js"
import { SpotifySongRequest } from "./services/song-request.js"

const ServicesLayer = Layer.mergeAll(
  SpotifySongRequest.Default,
  TwitchChatMacros.Default
)

const MainLayer = Effect.gen(function*() {
  const logLevel = yield* Config.logLevel("EFFECT_LOG_LEVEL").pipe(
    Config.withDefault(LogLevel.Info)
  )
  return HttpLayer.pipe(
    Layer.provide(ServicesLayer),
    Layer.provide(NodeContext.layer),
    Layer.provide(NodeHttpClient.layerUndici),
    Layer.provide(Logger.minimumLogLevel(logLevel))
  )
}).pipe(Layer.unwrapEffect)

MainLayer.pipe(
  Layer.launch,
  Effect.tapErrorCause(Effect.logError),
  NodeRuntime.runMain
)
