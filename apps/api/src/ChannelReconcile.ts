import { ChannelState } from "@twitch-integrations/domain/ChannelState"
import {
  ConnectionNotConfigured,
  type ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import type { EventSubscription } from "@twitch-integrations/domain/EventSubscription"
import { type Reward, songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Semaphore from "effect/Semaphore"
import { ChannelStore } from "./ChannelStore.ts"
import { Connections } from "./Connections.ts"
import { EventSubTransport } from "./EventSubTransport.ts"
import {
  type AccessToken,
  type EventSubscriptionRequest,
  Helix,
  type HelixRequestFailed,
} from "./Helix.ts"
import type { ProviderRequestFailed } from "./Provider.ts"
import { TwitchAppToken } from "./TwitchAppToken.ts"

/** Why a reconcile stopped: Twitch is not connected, or a Twitch request failed. */
export type ReconcileError =
  | ConnectionNotConfigured
  | ReauthorizationRequired
  | ProviderRequestFailed
  | HelixRequestFailed

export interface ChannelReconcileService {
  /**
   * Brings the channel in line with the spec, in order: the Reward is
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
  const connections = yield* Connections
  const transport = yield* EventSubTransport
  const settings = songRequestSettings

  // NOTE: one permit, shared later with Redemption processing, so a
  // reconcile never runs beside another reconcile or a Redemption.
  const lock = yield* Semaphore.make(1)

  /** The Twitch Connected Account's ID, which every Helix call names as the broadcaster. */
  const connectedAccountId: Effect.Effect<string, ConnectionNotConfigured> = Effect.gen(
    function* () {
      const summary = yield* connections.describe("twitch")
      return summary.connectedAccount === null
        ? yield* new ConnectionNotConfigured({ provider: "twitch" })
        : summary.connectedAccount.id
    },
  )

  /**
   * The Reward with its settings as the spec fixes them: created when none
   * is stored and none with the title is manageable, otherwise updated in
   * place. Never deleted, since deleting a reward fulfils its open
   * Redemptions.
   */
  const ensureReward = Effect.fn("ChannelReconcile.ensureReward")(function* (
    token: AccessToken,
    account: string,
  ) {
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

  const seedState = Effect.fn("ChannelReconcile.seedState")(function* (
    token: AccessToken,
    account: string,
  ) {
    const state: ChannelState = (yield* helix.isLive(token, account)) ? "Live" : "Offline"
    yield* store.writeState(state)
    return state
  })

  /** Paused while Offline, unpaused while Live; stored as Twitch reports it. */
  const setPause = Effect.fn("ChannelReconcile.setPause")(function* (
    token: AccessToken,
    account: string,
    reward: Reward,
    state: ChannelState,
  ) {
    const updated = yield* helix.updateReward(token, account, reward.id, {
      isPaused: state === "Offline",
    })
    yield* store.writeReward({ ...reward, isPaused: updated.isPaused })
  })

  const reconcile: Effect.Effect<void, ReconcileError> = lock.withPermit(
    Effect.gen(function* () {
      const token = yield* connections.getAccessToken("twitch")
      const account = yield* connectedAccountId
      const reward = yield* ensureReward(token, account)
      yield* replaceEventSubscriptions(account, reward.id)
      const state = yield* seedState(token, account)
      yield* setPause(token, account, reward, state)
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
    ChannelStore | Helix | TwitchAppToken | Connections | EventSubTransport
  > = Layer.effect(ChannelReconcile)(make)
}
