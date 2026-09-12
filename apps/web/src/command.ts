import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { Command, Http } from "foldkit"
import { Message } from "./message.ts"
import { Connections, requestTimeoutMs } from "./model.ts"

export const FetchConnections = Command.define("FetchConnections", {
  messages: [Message.SucceededFetchConnections, Message.FailedFetchConnections],
  execute: Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
    const response = yield* client.get("/setup/api/connections")
    const connections = yield* Schema.decodeUnknownEffect(Connections)(yield* response.json)
    return Message.SucceededFetchConnections({
      connections,
      checkedAt: yield* Clock.currentTimeMillis,
    })
  }).pipe(
    Effect.timeout(requestTimeoutMs),
    Effect.orElseSucceed(() =>
      Message.FailedFetchConnections({
        error:
          "The Connections could not be loaded. Refresh to try again; if this continues, reload the page to check your Access session.",
      }),
    ),
    // The Command is the browser HTTP entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    Effect.provide(Http.layer),
  ),
})

export const FetchChannel = Command.define("FetchChannel", {
  messages: [Message.SucceededFetchChannel, Message.FailedFetchChannel],
  execute: Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
    const response = yield* client.get("/setup/api/channel")
    const channel = yield* Schema.decodeUnknownEffect(ChannelMonitoring)(yield* response.json)
    return Message.SucceededFetchChannel({ channel, checkedAt: yield* Clock.currentTimeMillis })
  }).pipe(
    Effect.timeout(requestTimeoutMs),
    Effect.orElseSucceed(() =>
      Message.FailedFetchChannel({
        error:
          "Channel monitoring could not be loaded. Refresh to try again; if this continues, reload the page to check your Access session.",
      }),
    ),
    // The Command is the browser HTTP entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    Effect.provide(Http.layer),
  ),
})
