import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import { ChatCommandDraft } from "@twitch-integrations/domain/ChatCommand"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
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

const chatCommandsPath = "/setup/api/chat-commands"

const writeUnanswered =
  "The Chat Command could not be saved. Try again; if this continues, reload the page to check your Access session."

/** The small body a refused write carries. */
const Rejection = Schema.Struct({ message: Schema.String }).annotate({ identifier: "Rejection" })
const readRejection = Schema.decodeUnknownEffect(Rejection)

type WriteMessage =
  | typeof Message.SucceededChatCommandWrite.Type
  | typeof Message.FailedChatCommandWrite.Type

/**
 * Settles a write into its Message: a 2xx answer succeeded, any other answer
 * is refused with the message it carries, and no answer at all, or one with
 * no readable message, gets the generic wording.
 */
const settleWrite = <E, R>(
  request: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
): Effect.Effect<WriteMessage, never, R> =>
  Effect.gen(function* () {
    const response = yield* request
    if (response.status >= 200 && response.status < 300) {
      return Message.SucceededChatCommandWrite() as WriteMessage
    }
    const { message } = yield* Effect.flatMap(response.json, readRejection)
    return Message.FailedChatCommandWrite({ message }) as WriteMessage
  }).pipe(
    Effect.timeout(requestTimeoutMs),
    Effect.orElseSucceed(() => Message.FailedChatCommandWrite({ message: writeUnanswered })),
  )

const encodeDraft = Schema.encodeSync(ChatCommandDraft)

export const CreateChatCommand = Command.define("CreateChatCommand", {
  args: { name: Schema.String, response: Schema.String },
  messages: [Message.SucceededChatCommandWrite, Message.FailedChatCommandWrite],
  execute: ({ name, response }) =>
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.execute(
        HttpClientRequest.post(chatCommandsPath).pipe(
          HttpClientRequest.bodyJsonUnsafe({ name, response }),
        ),
      ),
    ).pipe(
      settleWrite,
      // The Command is the browser HTTP entry point.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(Http.layer),
    ),
})

export const UpdateChatCommand = Command.define("UpdateChatCommand", {
  args: { name: Schema.String, draft: ChatCommandDraft },
  messages: [Message.SucceededChatCommandWrite, Message.FailedChatCommandWrite],
  execute: ({ name, draft }) =>
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.execute(
        HttpClientRequest.put(`${chatCommandsPath}/${encodeURIComponent(name)}`).pipe(
          HttpClientRequest.bodyJsonUnsafe(encodeDraft(draft)),
        ),
      ),
    ).pipe(
      settleWrite,
      // The Command is the browser HTTP entry point.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(Http.layer),
    ),
})

export const DeleteChatCommand = Command.define("DeleteChatCommand", {
  args: { name: Schema.String },
  messages: [Message.SucceededChatCommandWrite, Message.FailedChatCommandWrite],
  execute: ({ name }) =>
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.del(`${chatCommandsPath}/${encodeURIComponent(name)}`),
    ).pipe(
      settleWrite,
      // The Command is the browser HTTP entry point.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      Effect.provide(Http.layer),
    ),
})
