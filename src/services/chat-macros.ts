import { Array, Config, Effect, Exit, Match, Option, Schedule, Stream } from "effect"
import type { ChannelChatMessageEvent } from "../domain/twitch.js"
import { TwitchClient } from "../twitch/client.js"
import { SpotifySongQueue } from "./song-queue.js"

export class TwitchChatMacros extends Effect.Service<TwitchChatMacros>()("app/TwitchChatMacros", {
  scoped: Effect.gen(function*() {
    const broadcasterId = yield* Config.string("TWITCH_BROADCASTER_ID")

    const spotifySongQueue = yield* SpotifySongQueue
    const twitchClient = yield* TwitchClient

    const getCurrentSong = Effect.fn("TwitchChatMacros.getCurrentSong")(
      function*(event: ChannelChatMessageEvent) {
        const exit = yield* Effect.exit(spotifySongQueue.getQueue())
        if (Exit.isFailure(exit)) {
          const message = `@${event.chatter_user_name} sorry, your request for the current song failed! NotLikeThis`
          return yield* twitchClient.sendChatMessage(message).pipe(
            Effect.retry({
              times: 3,
              schedule: Schedule.fixed("200 millis")
            }),
            Effect.ignoreLogged
          )
        }
        const queueItem = Array.head(exit.value)
        if (Option.isNone(queueItem) || queueItem.value.type === "episode") {
          const message = `@${event.chatter_user_name} no songs are currently in the Spotify song queue`
          return yield* twitchClient.sendChatMessage(message).pipe(
            Effect.retry({
              times: 3,
              schedule: Schedule.fixed("200 millis")
            }),
            Effect.ignoreLogged
          )
        }
        if (queueItem.value.type === "track") {
          const song = queueItem.value
          const name = song.name ?? "<unknown>"
          const artists = Array.filterMap(song.artists ?? [], (artist) => Option.fromNullable(artist.name))
          const artistsStr = artists.length === 0 ? "" : `by ${artists.join(", ")}`
          const message = `Current Song: ${name}${artistsStr}`
          return yield* twitchClient.sendChatMessage(message).pipe(
            Effect.retry({
              times: 3,
              schedule: Schedule.fixed("200 millis")
            }),
            Effect.ignoreLogged
          )
        }
      }
    )

    // !queue
    const handleChatMacro = Match.type<ChannelChatMessageEvent>().pipe(
      Match.when({ message: { text: "!song" } }, (event) => getCurrentSong(event)),
      Match.orElse(() => Effect.void)
    )

    const respondToChatMacro = Effect.fn("TwitchChatMacros.respondToChatMacro")(
      function*(event: ChannelChatMessageEvent) {
        if (event.message_type === "text") {
          return yield* handleChatMacro(event)
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
  dependencies: [
    TwitchClient.Default,
    SpotifySongQueue.Default
  ]
}) {}
