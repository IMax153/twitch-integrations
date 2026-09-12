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
import type { AccessToken } from "./Helix.ts"
import { type ProviderFailureReason, failureReason } from "./Provider.ts"

export type SpotifyOperation = "add to queue" | "get track"

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

/** A track as the Channel names it in chat: its name and its artists' names. */
export interface Track {
  readonly name: string
  readonly artists: ReadonlyArray<string>
}

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
}

const api = "https://api.spotify.com/v1"

const queueEndpoint = `${api}/me/player/queue`
const tracksEndpoint = `${api}/tracks`

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

/** Spotify's account of a refused request, or none when the failure was not a refusal or carried none. */
const spotifyDetail = (
  cause: HttpClientError.HttpClientError | Schema.SchemaError,
): Effect.Effect<Option.Option<string>> =>
  cause._tag === "HttpClientError" && cause.reason._tag === "StatusCodeError"
    ? readSpotifyError(cause.reason.response).pipe(
        Effect.map((body) => Option.some(body.error.reason ?? body.error.message)),
        Effect.orElseSucceed(Option.none),
      )
    : Effect.succeed(Option.none())

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
