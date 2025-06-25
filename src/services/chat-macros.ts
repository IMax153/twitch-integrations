import { Config, Effect, Match, Stream } from "effect"
import type { ChannelChatMessageEvent } from "../domain/twitch.js"
import { TwitchClient } from "../twitch/client.js"

export class TwitchChatMacros extends Effect.Service<TwitchChatMacros>()("app/TwitchChatMacros", {
  scoped: Effect.gen(function*() {
    const broadcasterId = yield* Config.string("TWITCH_BROADCASTER_ID")

    const twitchClient = yield* TwitchClient

    const macroMatcher = Match.type<string>().pipe(
      Match.when("!test", () => Effect.asVoid(twitchClient.sendChatMessage("This is a test!"))),
      Match.orElse(() => Effect.void)
    )

    const respondToChatMacro = Effect.fn("TwitchChatMacros.respondToChatMacro")(
      function*(event: ChannelChatMessageEvent) {
        if (event.message_type === "text") {
          return yield* macroMatcher(event.message.text)
        }
      }
    )

    yield* twitchClient.listenForEvent("channel.chat.message", {
      condition: {
        "broadcaster_user_id": broadcasterId,
        "user_id": broadcasterId
      }
    }).pipe(
      Stream.runForEach(respondToChatMacro),
      Effect.interruptible,
      Effect.forkScoped
    )

    return {} as const
  }).pipe(Effect.annotateLogs({
    service: "TwitchChatMacros"
  })),
  dependencies: [TwitchClient.Default]
}) {}
