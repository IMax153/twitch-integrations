import { Config, Data, Effect, Predicate, Schedule, Stream } from "effect"
import type * as SpotifyApi from "../domain/spotify.js"
import type { ChannelPointsCustomRewardRedemptionEvent } from "../domain/twitch.js"
import { SpotifyClient } from "../spotify/client.js"
import { TwitchClient } from "../twitch/client.js"

export type SongRequestError = InvalidSongUrl | SongNotFound | FailedToEnqueueSong

export class InvalidSongUrl extends Data.TaggedError("InvalidSongUrl")<{
  readonly url: string
}> {
  toChatMessage(userName: string): string {
    return [
      `@${userName} your song request URL was invalid.`,
      "Your points are being redeemed.",
      "Did you use a proper Spotify track URL? (https://support.spotify.com/us/artists/article/finding-your-artist-url/)"
    ].join(" ")
  }
}

export class SongNotFound extends Data.TaggedError("SongNotFound")<{
  readonly cause: unknown
  readonly trackId: string
}> {
  toChatMessage(userName: string): string {
    const url = `https://open.spotify.com/track/${this.trackId}`
    return [
      `@${userName} could not find the Spotify track you requested.`,
      "Your points are being redeemed.",
      `The Spotify track URL you entered was ${url}`
    ].join(" ")
  }
}

export class FailedToEnqueueSong extends Data.TaggedError("FailedToEnqueueSong")<{
  readonly cause: unknown
  readonly track: SpotifyApi.TrackObject
}> {
  toChatMessage(userName: string): string {
    return [
      `@${userName} failed to enqueue the Spotify track you requested.`,
      "Your points are being redeemed.",
      "Try again in a few seconds."
    ].join(" ")
  }
}

const SONG_URL_REGEX =
  /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]{22})(?:\?si=[a-zA-Z0-9_-]+)?$/

export class SpotifySongRequest extends Effect.Service<SpotifySongRequest>()("app/Spotify/SongRequest", {
  scoped: Effect.gen(function*() {
    const broadcasterId = yield* Config.string("TWITCH_BROADCASTER_ID")
    const songRequestRewardId = yield* Config.string("TWITCH_SONG_REQUEST_CUSTOM_REWARD_ID")

    const spotifyClient = yield* SpotifyClient
    const twitchClient = yield* TwitchClient

    const getSongIdentifier = Effect.fn("SongRequest.getSongIdentifier")(
      function*(songUrl: string) {
        const match = songUrl.match(SONG_URL_REGEX)
        if (Predicate.isNotNull(match) && Predicate.isNotUndefined(match[1])) {
          return match[1]
        }
        return yield* new InvalidSongUrl({ url: songUrl })
      }
    )

    const addToSongQueue = Effect.fn("SongRequest.addToSongQueue")(
      function*(event: ChannelPointsCustomRewardRedemptionEvent) {
        yield* Effect.logInfo("Received song request").pipe(
          Effect.annotateLogs({ song: event.user_input })
        )

        // Attempt to decode the track identifier from the song request message
        const trackId = yield* getSongIdentifier(event.user_input)

        // Get the track from the Spotify API
        const track = yield* spotifyClient.getTrack(trackId).pipe(
          Effect.mapError((cause) => new SongNotFound({ cause, trackId }))
        )

        // Add the track to the song queue
        yield* spotifyClient.addToQueue({ uri: track.uri ?? "" }).pipe(
          Effect.catchAll((cause) => new FailedToEnqueueSong({ cause, track }))
        )

        // Send a notification back to twitch to let the user know their song
        // request was successful
        const artists = (track.artists ?? []).map((artist) => artist.name).join(",")
        const message = `@${event.user_name} requested ${track.name} by ${artists}`
        yield* twitchClient.sendChatMessage(message).pipe(
          Effect.retry({
            times: 3,
            schedule: Schedule.fixed("200 millis")
          }),
          Effect.ignoreLogged
        )

        // Redeem the reward for the user
        yield* twitchClient.redeemChannelReward(event.reward.id, event.id).pipe(
          Effect.retry({
            times: 3,
            schedule: Schedule.fixed("200 millis")
          }),
          Effect.ignoreLogged
        )
      },
      (self, event) =>
        self.pipe(
          Effect.catchAll(Effect.fnUntraced(function*(error) {
            // Log the error for debugging purposes
            yield* Effect.logError(error).pipe(
              Effect.annotateLogs({ event })
            )

            // Convert the error to a Twitch chat message
            const message = error.toChatMessage(event.user_name)

            yield* twitchClient.sendChatMessage(message).pipe(
              Effect.retry({
                times: 3,
                schedule: Schedule.fixed("200 millis")
              }),
              Effect.ignoreLogged
            )

            // Make a best-effort attempt to redeem the user's points
            const successMessage = `@${event.user_name} your points have been redeemed`
            const failureMessage = `@${event.user_name} there was a problem redeeming your points`
            yield* twitchClient.refundChannelReward(event.reward.id, event.id).pipe(
              Effect.retry({
                times: 3,
                schedule: Schedule.fixed("200 millis")
              }),
              Effect.matchEffect({
                onSuccess: () => twitchClient.sendChatMessage(successMessage),
                onFailure: () => twitchClient.sendChatMessage(failureMessage)
              }),
              Effect.ignoreLogged
            )
          }))
        )
    )

    yield* twitchClient.listenForEvent("channel.channel_points_custom_reward_redemption.add", {
      condition: {
        broadcaster_user_id: broadcasterId,
        reward_id: songRequestRewardId
      }
    }).pipe(
      Stream.runForEach(addToSongQueue),
      Effect.interruptible,
      Effect.forkScoped
    )

    return {} as const
  }).pipe(Effect.annotateLogs({
    service: "SongRequest"
  })),
  dependencies: [
    SpotifyClient.Default,
    TwitchClient.Default
  ]
}) {}
