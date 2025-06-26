import { Array, Config, Effect, Exit, Match, Option, pipe, Schedule, Stream } from "effect"
import type * as Api from "../domain/spotify.js"
import type { ChannelChatMessageEvent } from "../domain/twitch.js"
import { TwitchClient } from "../twitch/client.js"
import type { SongQueue } from "./song-queue.js"
import { SpotifySongQueue } from "./song-queue.js"

export class TwitchChatMacros extends Effect.Service<TwitchChatMacros>()("app/TwitchChatMacros", {
  scoped: Effect.gen(function*() {
    const broadcasterId = yield* Config.string("TWITCH_BROADCASTER_ID")

    const spotifySongQueue = yield* SpotifySongQueue
    const twitchClient = yield* TwitchClient

    const handleEmptyQueue = Effect.fn("TwitchChatMacros.handleEmptyQueue")(
      function*(event: ChannelChatMessageEvent) {
        const message = `@${event.chatter_user_name} no songs are currently in the Spotify song queue`
        return yield* twitchClient.sendChatMessage(message).pipe(
          Effect.retry({
            times: 3,
            schedule: Schedule.fixed("200 millis")
          }),
          Effect.ignoreLogged
        )
      }
    )

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
          return yield* handleEmptyQueue(event)
        }
        if (queueItem.value.type === "track") {
          const track = renderTrack(queueItem.value)
          const message = `Current Song: ${track}`
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

    const getSongQueue = Effect.fn("TwitchChatMacros.getSongQueue")(
      function*(event: ChannelChatMessageEvent) {
        const exit = yield* Effect.exit(spotifySongQueue.getQueue())
        if (Exit.isFailure(exit)) {
          const message = `@${event.chatter_user_name} sorry, your request for the song queue failed! NotLikeThis`
          return yield* twitchClient.sendChatMessage(message).pipe(
            Effect.retry({
              times: 3,
              schedule: Schedule.fixed("200 millis")
            }),
            Effect.ignoreLogged
          )
        }
        const tracks = Array.take(Array.filter(exit.value, isTrackObject), 4)
        if (Array.isNonEmptyReadonlyArray(tracks)) {
          const current = renderTrack(Array.headNonEmpty(tracks))
          const currentMsg = `Currently Playing: ${current}`
          const next = pipe(
            Array.drop(tracks, 1),
            Array.map((track, index) => `${index + 1}. ${renderTrack(track)}`),
            Array.join(" | ")
          )
          const nextMsg = next.length > 0 ? ` ||| Next Up: ${next}` : ""
          const message = `${currentMsg}${nextMsg}`
          return yield* twitchClient.sendChatMessage(message).pipe(
            Effect.retry({
              times: 3,
              schedule: Schedule.fixed("200 millis")
            }),
            Effect.ignoreLogged
          )
        }
        return yield* handleEmptyQueue(event)
      }
    )

    const handleChatMacro = Match.type<ChannelChatMessageEvent>().pipe(
      Match.when({ message: { text: "!song" } }, (event) => getCurrentSong(event)),
      Match.when({ message: { text: "!song-queue" } }, (event) => getSongQueue(event)),
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

function isTrackObject(item: SongQueue[number]): item is Api.TrackObject {
  return item.type === "track"
}

function renderTrack(track: Api.TrackObject) {
  const name = track.name ?? "<unknown>"
  const artists = Array.filterMap(track.artists ?? [], (artist) => Option.fromNullable(artist.name))
  const artistsStr = artists.length === 0 ? "" : ` by ${artists.join(", ")}`
  return `${name}${artistsStr}`
}
