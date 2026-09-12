import type { CancellationReason } from "@twitch-integrations/domain/RedemptionOutcome"
import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { parseSongRequestInput } from "@twitch-integrations/domain/SongRequestInput"
import {
  type QueuedTrack,
  cancelledReply,
  describeTrack,
  fulfilledReply,
  trackPageLink,
} from "@twitch-integrations/domain/SongRequestReply"
import { logFailure, observed } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import * as Schedule from "effect/Schedule"
import { ChannelStore } from "./ChannelStore.ts"
import { Connections } from "./Connections.ts"
import { type AccessToken, Helix, type RedemptionStatus } from "./Helix.ts"
import { Spotify, noActiveDevice } from "./Spotify.ts"
import { TwitchAccess, type TwitchAccessGrant, type TwitchAccessService } from "./TwitchAccess.ts"

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

/**
 * How a fulfil that fails is tried again: three more times, each after a
 * short wait. The waits run under the Channel's lock, so their sum stays
 * well inside the few seconds Twitch gives a notification that arrives
 * meanwhile to be acknowledged.
 */
const fulfilRetries = Schedule.max([Schedule.recurs(3), Schedule.spaced("500 millis")])

/**
 * Whether the Twitch Connection's failure means Twitch cannot be reached at
 * all, as opposed to one request failing. The failure crosses the object RPC
 * as a plain object, so only its tag is looked at.
 */
const isTwitchUnavailable = (failure: Effect.Error<TwitchAccessService["current"]>) =>
  failure._tag === "ConnectionNotConfigured" || failure._tag === "ReauthorizationRequired"

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

  /**
   * Tells the viewer in chat as the Twitch Connected Account. A reply that
   * fails to send, or that Twitch does not show, is logged and nothing more:
   * chat trouble never changes what happened to the Redemption.
   */
  const reply = Effect.fn("SongRequests.reply")(
    function* (grant: TwitchAccessGrant, redemption: Redemption, message: string) {
      const sent = yield* helix.sendChatMessage(grant.token, grant.account, message)
      if (!sent.isSent) {
        const reason = Option.getOrElse(sent.dropReason, () => "no reason given")
        yield* Effect.logWarning(`Twitch dropped the reply to ${redemption.viewerName}: ${reason}`)
      }
    },
    (sending) => sending.pipe(observed, Effect.ignore),
  )

  /** Ends the Redemption on Twitch one way or the other, as the Twitch Connected Account. */
  const end = (grant: TwitchAccessGrant, redemption: Redemption, status: RedemptionStatus) =>
    helix.updateRedemptionStatus(
      grant.token,
      grant.account,
      redemption.rewardId,
      redemption.id,
      status,
    )

  /**
   * Cancels the Redemption on Twitch, which refunds the viewer, and tells
   * them why. While the Twitch Connection has no token to give, Twitch
   * cannot be reached, so the Redemption is held for the next reconcile to
   * cancel instead.
   */
  const cancel = Effect.fn("SongRequests.cancel")(function* (
    redemption: Redemption,
    reason: CancellationReason,
  ) {
    const granted = yield* Effect.result(access.current)
    if (Result.isFailure(granted)) {
      if (!isTwitchUnavailable(granted.failure)) {
        return yield* Effect.fail(granted.failure)
      }
      yield* store.holdRedemption({ redemption, reason: "TwitchUnavailable" })
      yield* Effect.logWarning(
        `Held Redemption ${redemption.id} from ${redemption.viewerName}: ${reason}, but the Twitch Connection is ${granted.failure._tag}`,
      )
      return
    }
    const grant = granted.success
    yield* end(grant, redemption, "CANCELED")
    yield* Effect.logInfo(
      `Cancelled Redemption ${redemption.id} from ${redemption.viewerName}: ${reason}`,
    )
    yield* reply(grant, redemption, cancelledReply(redemption.viewerName, reason))
  })

  /**
   * Fulfils the queued Redemption on Twitch and tells the viewer what was
   * queued. A fulfil that keeps failing is given up on and the Redemption
   * left unfulfilled, never cancelled: the viewer got their song.
   */
  const fulfil = Effect.fn("SongRequests.fulfil")(function* (
    redemption: Redemption,
    track: QueuedTrack,
  ) {
    const grant = yield* access.current
    yield* end(grant, redemption, "FULFILLED").pipe(
      Effect.tapError(logFailure),
      Effect.retry(fulfilRetries),
      Effect.tapError(() =>
        Effect.logWarning(
          `Left Redemption ${redemption.id} from ${redemption.viewerName} unfulfilled: Twitch kept refusing`,
        ),
      ),
    )
    yield* Effect.logInfo(`Fulfilled Redemption ${redemption.id}: queued ${track.description}`)
    yield* reply(grant, redemption, fulfilledReply(redemption.viewerName, track))
  })

  const process: SongRequestsService["process"] = Effect.fn("SongRequests.process")(
    function* (redemption) {
      const queued = yield* Effect.result(queueTrack(redemption))
      if (Result.isFailure(queued)) {
        yield* cancel(redemption, queued.failure.reason).pipe(observed, Effect.ignore)
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
