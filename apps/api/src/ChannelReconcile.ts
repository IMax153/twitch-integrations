import type { ChannelState } from "@twitch-integrations/domain/ChannelState"
import type {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import type { EventSubscription } from "@twitch-integrations/domain/EventSubscription"
import type { HeldRedemption } from "@twitch-integrations/domain/Redemption"
import { type Reward, songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { EventSubTransport } from "./EventSubTransport.ts"
import { type EventSubscriptionRequest, Helix, type HelixRequestFailed } from "./Helix.ts"
import { logFailure } from "@twitch-integrations/infra/Failure"
import type { ProviderRequestFailed } from "./Provider.ts"
import { RewardPause } from "./RewardPause.ts"
import { TwitchAccess, type TwitchAccessGrant } from "./TwitchAccess.ts"
import { TwitchAppToken } from "./TwitchAppToken.ts"

/** Why a reconcile stopped: Twitch is not connected, or a Twitch request failed. */
export type ReconcileError =
  | ConnectionNotConfigured
  | ReauthorizationRequired
  | ProviderRequestFailed
  | HelixRequestFailed

export interface ChannelReconcileService {
  /**
   * Brings the channel in line with the spec, in order: every held
   * Redemption is cancelled, which refunds its viewer, the Reward is
   * created or its settings updated in place, this client ID's Event
   * Subscriptions are replaced, the Channel's state is seeded from Get
   * Streams, and the Reward is paused or unpaused to match. Runs under the
   * Channel's one lock, so two reconciles never interleave.
   */
  readonly reconcile: Effect.Effect<void, ReconcileError>
}

/**
 * The three Event Subscriptions the deployment keeps, about the Connected
 * Account's channel and, for Redemptions, the Reward alone.
 */
const eventSubscriptionRequests = (
  connectedAccountId: string,
  rewardId: string,
): ReadonlyArray<EventSubscriptionRequest> => [
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    condition: { broadcaster_user_id: connectedAccountId, reward_id: rewardId },
  },
  {
    type: "stream.online",
    version: "1",
    condition: { broadcaster_user_id: connectedAccountId },
  },
  {
    type: "stream.offline",
    version: "1",
    condition: { broadcaster_user_id: connectedAccountId },
  },
]

/**
 * Whether Twitch answered a Redemption update with its "not found or not
 * UNFULFILLED" refusal: the Redemption has been ended some other way.
 */
const noLongerUnfulfilled = (failure: HelixRequestFailed) =>
  failure.reason._tag === "Status" && failure.reason.status === 404

/** The ID of the reward with the title among those this client ID may manage, if there is one. */
const manageableIdWithTitle = (rewards: ReadonlyArray<Reward>, title: string) =>
  Option.map(
    Option.fromUndefinedOr(rewards.find((reward) => reward.title === title)),
    (reward) => reward.id,
  )

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const helix = yield* Helix
  const appToken = yield* TwitchAppToken
  const transport = yield* EventSubTransport
  const lock = yield* ChannelLock
  const access = yield* TwitchAccess
  const pause = yield* RewardPause
  const settings = songRequestSettings

  /**
   * Cancels one Redemption held while Twitch could not be reached, which
   * refunds the viewer, and forgets it. One Twitch reports is no longer
   * unfulfilled has been ended some other way and is forgotten too. Any
   * other refusal is logged and the Redemption stays held for the next
   * reconcile, so one Redemption never keeps the rest of the channel from
   * being brought in line.
   */
  const settle = Effect.fn("ChannelReconcile.settle")(function* (
    { token, account }: TwitchAccessGrant,
    { redemption }: HeldRedemption,
  ) {
    const cancelled = yield* Effect.result(
      helix.updateRedemptionStatus(token, account, redemption.rewardId, redemption.id, "CANCELED"),
    )
    const who = `held Redemption ${redemption.id} from ${redemption.viewerName}`
    if (Result.isSuccess(cancelled)) {
      yield* Effect.logInfo(`Cancelled ${who}`)
    } else if (noLongerUnfulfilled(cancelled.failure)) {
      yield* Effect.logInfo(`Dropped ${who}: Twitch reports it no longer unfulfilled`)
    } else {
      yield* logFailure(cancelled.failure)
      yield* Effect.logWarning(`Kept ${who} for the next reconcile: Twitch refused the cancel`)
      return
    }
    yield* store.releaseHeldRedemption(redemption.id)
  })

  /** Cancels every held Redemption in the order they were held, before anything else on the channel is touched. */
  const settleHeldRedemptions = Effect.fn("ChannelReconcile.settleHeldRedemptions")(function* (
    grant: TwitchAccessGrant,
  ) {
    const held = yield* store.readHeldRedemptions
    yield* Effect.forEach(held, (heldRedemption) => settle(grant, heldRedemption))
  })

  /**
   * The Reward with its settings as the spec fixes them: created when none
   * is stored and none with the title is manageable, otherwise updated in
   * place. Never deleted, since deleting a reward fulfils its open
   * Redemptions.
   */
  const ensureReward = Effect.fn("ChannelReconcile.ensureReward")(function* ({
    token,
    account,
  }: TwitchAccessGrant) {
    const stored = yield* store.readReward
    const existingId = Option.isSome(stored)
      ? Option.some(stored.value.id)
      : manageableIdWithTitle(yield* helix.listManageableRewards(token, account), settings.title)
    const reward = Option.isNone(existingId)
      ? yield* helix.createReward(token, account, settings)
      : yield* helix.updateReward(token, account, existingId.value, { settings })
    yield* Effect.logInfo(
      Option.isNone(existingId)
        ? `Created the ${settings.title} Reward ${reward.id}`
        : `Updated the ${settings.title} Reward ${reward.id}`,
    )
    yield* store.writeReward(reward)
    return reward
  })

  /** Deletes every Event Subscription this client ID owns and creates the three afresh. */
  const replaceEventSubscriptions = Effect.fn("ChannelReconcile.replaceEventSubscriptions")(
    function* (account: string, rewardId: string) {
      if (!transport.enabled) {
        yield* Effect.logInfo("Skipping Event Subscriptions under alchemy dev")
        return
      }
      const token = yield* appToken.get
      const existing = yield* helix.listEventSubscriptions(token)
      yield* Effect.forEach(existing, (subscription) =>
        helix.deleteEventSubscription(token, subscription.id),
      )
      const created = yield* Effect.forEach(
        eventSubscriptionRequests(account, rewardId),
        (request) =>
          Effect.map(
            helix.createEventSubscription(token, request, transport),
            (subscription): EventSubscription => ({
              id: subscription.id,
              type: request.type,
              version: subscription.version,
              status: subscription.status,
              revocationReason: Option.none(),
            }),
          ),
      )
      yield* store.replaceEventSubscriptions(created)
      yield* Effect.logInfo(
        `Replaced ${existing.length} Event Subscriptions with ${created.length}`,
      )
    },
  )

  const seedState = Effect.fn("ChannelReconcile.seedState")(function* ({
    token,
    account,
  }: TwitchAccessGrant) {
    const state: ChannelState = (yield* helix.isLive(token, account)) ? "Live" : "Offline"
    yield* store.writeState(state)
    return state
  })

  const reconcile: Effect.Effect<void, ReconcileError> = lock.withPermit(
    Effect.gen(function* () {
      const grant = yield* access.current
      yield* settleHeldRedemptions(grant)
      const reward = yield* ensureReward(grant)
      yield* replaceEventSubscriptions(grant.account, reward.id)
      const state = yield* seedState(grant)
      yield* pause.applyState(grant, reward, state)
    }),
  )

  return ChannelReconcile.of({ reconcile })
})

/** The rules for bringing the Twitch channel in line with the spec. */
export class ChannelReconcile extends Context.Service<ChannelReconcile, ChannelReconcileService>()(
  "@twitch-integrations/api/ChannelReconcile",
) {
  static readonly layer: Layer.Layer<
    ChannelReconcile,
    never,
    | ChannelStore
    | Helix
    | TwitchAppToken
    | EventSubTransport
    | ChannelLock
    | TwitchAccess
    | RewardPause
  > = Layer.effect(ChannelReconcile)(make)
}
