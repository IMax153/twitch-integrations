import type { CancellationReason } from "@twitch-integrations/domain/RedemptionOutcome"
import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { parseSongRequestInput } from "@twitch-integrations/domain/SongRequestInput"
import {
  type QueuedTrack,
  describeTrack,
  replyTo,
  trackPageLink,
} from "@twitch-integrations/domain/SongRequestReply"
import { logFailure, observed } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import { ChannelStore } from "./ChannelStore.ts"
import { Connections } from "./Connections.ts"
import { type AccessToken, Helix } from "./Helix.ts"
import { Spotify, noActiveDevice } from "./Spotify.ts"
import { TwitchAccess } from "./TwitchAccess.ts"

export interface SongRequestsService {
  /**
   * Takes one Redemption of the Reward to its end: the track queued on
   * Spotify, the Redemption fulfilled, and the viewer told in chat. Never
   * fails: what cannot be done is logged.
   */
  readonly process: (redemption: Redemption) => Effect.Effect<void>
}

/** Why the track was not queued, decided before any change is made on Twitch. */
class NotQueued extends Data.TaggedError("NotQueued")<{ readonly reason: CancellationReason }> {}

const notQueued = (reason: CancellationReason) => new NotQueued({ reason })

/** A track added to the Spotify queue, and the token it was added under for the lookup that follows. */
interface Queued {
  readonly token: AccessToken
  readonly trackId: string
}

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const connections = yield* Connections
  const spotify = yield* Spotify
  const helix = yield* Helix
  const access = yield* TwitchAccess

  /** The Spotify Connection's token, or why the track cannot be queued without one. */
  const spotifyToken = connections.getAccessToken("spotify").pipe(
    Effect.tapError(logFailure),
    Effect.mapError((failure) =>
      notQueued(failure._tag === "ProviderRequestFailed" ? "Failed" : "SpotifyUnavailable"),
    ),
  )

  /**
   * Queues the track the Redemption names, and returns the ID of what was
   * queued, or fails with why nothing was: the channel is Offline, the input
   * is not a track link, Spotify cannot be reached, or nothing is playing.
   */
  const queueTrack = Effect.fn("SongRequests.queueTrack")(function* (
    redemption: Redemption,
  ): Generator<Effect.Effect<unknown, NotQueued>, Queued> {
    if ((yield* store.readState) === "Offline") {
      return yield* notQueued("Offline")
    }
    const input = parseSongRequestInput(redemption.input)
    if (input._tag === "NotATrackLink") {
      return yield* notQueued("NotATrackLink")
    }
    const token = yield* spotifyToken
    yield* spotify.addToQueue(token, input.trackId).pipe(
      Effect.tapError(logFailure),
      Effect.mapError((failure) =>
        notQueued(failure.detail === noActiveDevice ? "NothingPlaying" : "Failed"),
      ),
    )
    return { token, trackId: input.trackId }
  })

  /** How the queued track is named in chat: by name and artists, or by its link when the lookup fails. */
  const nameTrack = Effect.fn("SongRequests.nameTrack")(function* ({
    token,
    trackId,
  }: Queued): Generator<Effect.Effect<unknown>, QueuedTrack> {
    const link = trackPageLink(trackId)
    const description = yield* spotify.getTrack(token, trackId).pipe(
      Effect.map(describeTrack),
      Effect.tapError(logFailure),
      Effect.orElseSucceed(() => link),
    )
    return { description, link }
  })

  /** Fulfils the queued Redemption on Twitch and tells the viewer, each as the Twitch Connected Account. */
  const fulfil = Effect.fn("SongRequests.fulfil")(function* (
    redemption: Redemption,
    track: QueuedTrack,
  ) {
    const grant = yield* access.current
    yield* helix.updateRedemptionStatus(
      grant.token,
      grant.account,
      redemption.rewardId,
      redemption.id,
      "FULFILLED",
    )
    yield* Effect.logInfo(`Fulfilled Redemption ${redemption.id}: queued ${track.description}`)
    const message = replyTo(redemption.viewerName, { _tag: "Fulfilled" }, track)
    const sent = yield* helix.sendChatMessage(grant.token, grant.account, message)
    if (!sent.isSent) {
      const reason = Option.getOrElse(sent.dropReason, () => "no reason given")
      yield* Effect.logWarning(`Twitch dropped the reply to ${redemption.viewerName}: ${reason}`)
    }
  })

  const process: SongRequestsService["process"] = Effect.fn("SongRequests.process")(
    function* (redemption) {
      const queued = yield* Effect.result(queueTrack(redemption))
      if (Result.isFailure(queued)) {
        yield* Effect.logInfo(
          `Song Request ${redemption.id} from ${redemption.viewerName} was not queued: ${queued.failure.reason}`,
        )
        return
      }
      const track = yield* nameTrack(queued.success)
      yield* fulfil(redemption, track).pipe(observed, Effect.ignore)
    },
  )

  return SongRequests.of({ process })
})

/** The rules for one Song Request: what the spec says happens to a Redemption of the Reward. */
export class SongRequests extends Context.Service<SongRequests, SongRequestsService>()(
  "@twitch-integrations/api/SongRequests",
) {
  static readonly layer: Layer.Layer<
    SongRequests,
    never,
    ChannelStore | Connections | Spotify | Helix | TwitchAccess
  > = Layer.effect(SongRequests)(make)
}
