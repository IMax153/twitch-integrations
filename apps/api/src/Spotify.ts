import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import type { OverlayTrack, Playback } from "@twitch-integrations/domain/Overlay"
import { upNextLimit } from "@twitch-integrations/domain/Overlay"
import type { Track } from "@twitch-integrations/domain/SongRequestReply"
import type { AccessToken } from "./Helix.ts"
import { type ProviderFailureReason, failureReason, refusalDetail } from "./Provider.ts"

export type SpotifyOperation = "add to queue" | "get track" | "get playback" | "get queue"

/**
 * A Spotify Web API call failed. Carries only what the failure was, never
 * the request or response, since those hold the access token and this
 * error may be logged. Spotify's own account of a refusal, such as
 * `NO_ACTIVE_DEVICE`, is kept when it gave one.
 */
export class SpotifyRequestFailed extends Data.TaggedError("SpotifyRequestFailed")<{
  readonly operation: SpotifyOperation
  readonly reason: ProviderFailureReason
  /** Spotify's reason code for a player refusal, or its message, when it gave one. */
  readonly detail?: string
}> {}

/** Spotify's reason code when no device is playing, which the player endpoints answer with. */
export const noActiveDevice = "NO_ACTIVE_DEVICE"

export interface SpotifyService {
  /** Adds the track to the queue of the Connected Account's active device. */
  readonly addToQueue: (
    token: AccessToken,
    trackId: string,
  ) => Effect.Effect<void, SpotifyRequestFailed>
  readonly getTrack: (
    token: AccessToken,
    trackId: string,
  ) => Effect.Effect<Track, SpotifyRequestFailed>
  /**
   * What the Connected Account's active device is playing, or none while
   * no device is active or the item is not a track, such as a podcast
   * episode.
   */
  readonly getPlayback: (
    token: AccessToken,
  ) => Effect.Effect<Option.Option<Playback>, SpotifyRequestFailed>
  /** The next tracks in the Connected Account's queue, at most the Overlay's limit, skipping items that are not tracks. */
  readonly getQueue: (
    token: AccessToken,
  ) => Effect.Effect<ReadonlyArray<OverlayTrack>, SpotifyRequestFailed>
}

const api = "https://api.spotify.com/v1"

const queueEndpoint = `${api}/me/player/queue`
const tracksEndpoint = `${api}/tracks`
const playerEndpoint = `${api}/me/player`

/** The one part of a Spotify error body worth keeping: the reason code a player refusal carries, else the message. */
const SpotifyError = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    reason: Schema.optional(Schema.String),
  }).annotate({ identifier: "SpotifyErrorDetail" }),
}).annotate({ identifier: "SpotifyError" })

const readSpotifyError = HttpClientResponse.schemaBodyJson(SpotifyError)

const TrackWire = Schema.Struct({
  name: Schema.String,
  artists: Schema.Array(
    Schema.Struct({ name: Schema.String }).annotate({ identifier: "ArtistWire" }),
  ),
}).annotate({ identifier: "TrackWire" })

const readTrack = HttpClientResponse.schemaBodyJson(TrackWire)

/**
 * A playable item as the player and queue endpoints report it. Only a track
 * has artists and an album; an episode has neither, and both endpoints may
 * report one, so those fields are optional and an item without them is
 * left out of what the Overlay shows.
 */
const ItemWire = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  duration_ms: Schema.Int,
  artists: Schema.Array(
    Schema.Struct({ name: Schema.String }).annotate({ identifier: "ArtistWire" }),
  ).pipe(Schema.optional),
  album: Schema.optional(
    Schema.Struct({
      images: Schema.Array(
        Schema.Struct({
          url: Schema.String,
          width: Schema.Int.pipe(Schema.NullOr, Schema.optional),
        }).annotate({ identifier: "ImageWire" }),
      ),
    }).annotate({ identifier: "AlbumWire" }),
  ),
}).annotate({ identifier: "ItemWire" })
type ItemWire = typeof ItemWire.Type

/** The player's state; `item` is null between tracks and `progress_ms` null when unknown. */
const PlayerWire = Schema.Struct({
  is_playing: Schema.Boolean,
  progress_ms: Schema.Int.pipe(Schema.NullOr, Schema.optional),
  item: Schema.NullOr(ItemWire),
}).annotate({ identifier: "PlayerWire" })

const QueueWire = Schema.Struct({
  queue: Schema.Array(ItemWire),
}).annotate({ identifier: "QueueWire" })

const readPlayer = HttpClientResponse.schemaBodyJson(PlayerWire)
const readQueue = HttpClientResponse.schemaBodyJson(QueueWire)

/**
 * The cover image the Overlay shows: Spotify lists a 640, a 300, and a 64
 * pixel image, and the 300 is the smallest that stays crisp at the widget's
 * size. The largest is the fallback when none is that wide.
 */
const artworkWidth = 300

const artworkOf = (item: ItemWire): Option.Option<string> => {
  const images = [...(item.album?.images ?? [])].sort(
    (a, b) => (a.width ?? Infinity) - (b.width ?? Infinity),
  )
  const fitting = images.find((image) => (image.width ?? Infinity) >= artworkWidth)
  return Option.fromNullishOr((fitting ?? images[images.length - 1])?.url)
}

/** The item as an Overlay track, or none when it is not a track. */
const overlayTrack = (item: ItemWire): Option.Option<OverlayTrack> =>
  item.type !== "track" || item.artists === undefined
    ? Option.none()
    : Option.some({
        name: item.name,
        artists: item.artists.map((artist) => artist.name),
        artworkUrl: artworkOf(item),
        durationMs: item.duration_ms,
      })

/** Spotify answers the player endpoint with no body while no device is active. */
const noContent = 204

/** Spotify's reason code for a player refusal, else its message, when it gave one. */
const spotifyDetail = refusalDetail((response) =>
  Effect.map(readSpotifyError(response), (body) => body.error.reason ?? body.error.message),
)

/** The URI Spotify's queue endpoint takes for a track. */
const trackUri = (trackId: string) => `spotify:track:${trackId}`

const make = Effect.gen(function* () {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)

  const failed =
    (operation: SpotifyOperation) =>
    (
      cause: HttpClientError.HttpClientError | Schema.SchemaError,
    ): Effect.Effect<never, SpotifyRequestFailed> =>
      Effect.flatMap(spotifyDetail(cause), (detail) =>
        Effect.fail(
          new SpotifyRequestFailed({
            operation,
            reason: failureReason(cause),
            ...Option.match(detail, {
              onNone: () => ({}),
              onSome: (detail) => ({ detail }),
            }),
          }),
        ),
      )

  const service: SpotifyService = {
    addToQueue: (token, trackId) =>
      HttpClientRequest.post(queueEndpoint).pipe(
        HttpClientRequest.setUrlParams({ uri: trackUri(trackId) }),
        HttpClientRequest.bearerToken(token),
        client.execute,
        Effect.asVoid,
        Effect.catch(failed("add to queue")),
      ),

    getTrack: Effect.fn("Spotify.getTrack")(
      function* (token: AccessToken, trackId: string) {
        const request = HttpClientRequest.get(
          `${tracksEndpoint}/${encodeURIComponent(trackId)}`,
        ).pipe(HttpClientRequest.bearerToken(token))
        const wire = yield* readTrack(yield* client.execute(request))
        return { name: wire.name, artists: wire.artists.map((artist) => artist.name) }
      },
      Effect.catch(failed("get track")),
    ),

    getPlayback: Effect.fn("Spotify.getPlayback")(
      function* (token: AccessToken) {
        const request = HttpClientRequest.get(playerEndpoint).pipe(
          HttpClientRequest.bearerToken(token),
        )
        const response = yield* client.execute(request)
        if (response.status === noContent) {
          return Option.none()
        }
        const wire = yield* readPlayer(response)
        if (wire.item === null) {
          return Option.none()
        }
        return Option.map(overlayTrack(wire.item), (track) => ({
          track,
          progressMs: wire.progress_ms ?? 0,
          isPlaying: wire.is_playing,
        }))
      },
      Effect.catch(failed("get playback")),
    ),

    getQueue: Effect.fn("Spotify.getQueue")(
      function* (token: AccessToken) {
        const request = HttpClientRequest.get(queueEndpoint).pipe(
          HttpClientRequest.bearerToken(token),
        )
        const wire = yield* readQueue(yield* client.execute(request))
        return wire.queue
          .flatMap((item) => Option.toArray(overlayTrack(item)))
          .slice(0, upNextLimit)
      },
      Effect.catch(failed("get queue")),
    ),
  }
  return service
})

/** The Spotify Web API calls the Channel makes on the Broadcaster's behalf, each under the Spotify Connection's token. */
export class Spotify extends Context.Service<Spotify, SpotifyService>()(
  "@twitch-integrations/api/Spotify",
) {
  static readonly layer: Layer.Layer<Spotify, never, HttpClient.HttpClient> =
    Layer.effect(Spotify)(make)
}
