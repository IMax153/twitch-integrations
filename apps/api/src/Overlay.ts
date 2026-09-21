import {
  type IssuedOverlayKey,
  type NowPlaying,
  OverlayKey,
  overlayKeyBytes,
} from "@twitch-integrations/domain/Overlay"
import { NowPlayingUnavailable, UnknownOverlayKey } from "@twitch-integrations/domain/OverlayErrors"
import { logFailure } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as Crypto from "effect/Crypto"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelStore } from "./ChannelStore.ts"
import { Connections } from "./Connections.ts"
import { Spotify } from "./Spotify.ts"

export interface OverlayService {
  /**
   * Issues a fresh Overlay Key, revoking whatever one came before: the
   * Channel stores only its digest, so this is the one moment the key is
   * known.
   */
  readonly issueKey: Effect.Effect<IssuedOverlayKey>
  /**
   * What the Overlay shows, for a caller presenting the current Overlay
   * Key. A key that matches nothing is refused before Spotify is involved.
   */
  readonly readNowPlaying: (
    key: string,
  ) => Effect.Effect<NowPlaying, UnknownOverlayKey | NowPlayingUnavailable>
}

/**
 * How long one answer from Spotify serves every Overlay that asks. A browser
 * source polls every few seconds, and OBS opens one per scene the widget is
 * in, so the Channel asks Spotify at most this often however many ask it.
 */
const nowPlayingTtl = Duration.seconds(2)

/** Whether two hex digests are equal, in time that depends only on their length. */
const digestsMatch = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const connections = yield* Connections
  const spotify = yield* Spotify
  const crypto = yield* Crypto.Crypto

  // The key guards a public route, so it comes from the platform's
  // cryptographic source, which cannot fail to produce a few bytes.
  const digestOf = (key: string) =>
    Effect.map(crypto.digest("SHA-256", new TextEncoder().encode(key)), Encoding.encodeHex).pipe(
      Effect.orDie,
    )

  const issueKey: OverlayService["issueKey"] = Effect.gen(function* () {
    const bytes = yield* Effect.orDie(crypto.randomBytes(overlayKeyBytes))
    const key = OverlayKey.make(Encoding.encodeBase64Url(bytes))
    const issuedAt = yield* DateTime.now
    yield* store.writeOverlayKey({ digest: yield* digestOf(key), issuedAt })
    yield* Effect.logInfo("Issued a new Overlay Key")
    return { key, issuedAt }
  })

  /** The Spotify Connection's token, or why the Overlay has nothing to show without one. */
  const spotifyToken = connections.getAccessToken("spotify").pipe(
    Effect.tapError(logFailure),
    Effect.mapError((failure) =>
      NowPlayingUnavailable.make({
        reason: failure._tag === "ProviderRequestFailed" ? "Failed" : "SpotifyUnavailable",
      }),
    ),
  )

  const askSpotify: Effect.Effect<NowPlaying, NowPlayingUnavailable> = Effect.gen(function* () {
    const token = yield* spotifyToken
    const [playback, upNext] = yield* Effect.all(
      [spotify.getPlayback(token), spotify.getQueue(token)],
      { concurrency: 2 },
    ).pipe(
      Effect.tapError(logFailure),
      Effect.mapError(() => NowPlayingUnavailable.make({ reason: "Failed" })),
    )
    return { observedAt: yield* DateTime.now, playback, upNext }
  })

  const cachedNowPlaying = yield* Effect.cachedWithTTL(askSpotify, nowPlayingTtl)

  const readNowPlaying: OverlayService["readNowPlaying"] = Effect.fn("Overlay.readNowPlaying")(
    function* (key) {
      const stored = yield* store.readOverlayKey
      const presented = yield* digestOf(key)
      if (Option.isNone(stored) || !digestsMatch(stored.value.digest, presented)) {
        return yield* UnknownOverlayKey.make()
      }
      return yield* cachedNowPlaying
    },
  )

  return Overlay.of({ issueKey, readNowPlaying })
})

/**
 * The Overlay's side of the Channel: issuing the one Overlay Key and
 * answering, to whoever presents it, what Spotify is playing and what comes
 * next. It holds no lock: nothing it does writes what a reconcile or a
 * Redemption reads.
 */
export class Overlay extends Context.Service<Overlay, OverlayService>()(
  "@twitch-integrations/api/Overlay",
) {
  static readonly layer: Layer.Layer<
    Overlay,
    never,
    ChannelStore | Connections | Spotify | Crypto.Crypto
  > = Layer.effect(Overlay)(make)
}
