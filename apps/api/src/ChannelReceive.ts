import type { ChannelState } from "@twitch-integrations/domain/ChannelState"
import type { Notification, Revocation } from "@twitch-integrations/domain/Notification"
import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { RedemptionQueue } from "./RedemptionQueue.ts"
import { RewardPause } from "./RewardPause.ts"
import { TwitchAccess } from "./TwitchAccess.ts"

export interface ChannelReceiveService {
  /**
   * Acts on a verified notification and returns once what it changed is
   * durable. A notification seen before, or one the Channel has no use
   * for, changes nothing.
   */
  readonly receive: (notification: Notification) => Effect.Effect<void>
}

/** How long a processed Notification's message ID is remembered, so a resend inside the window is not processed again. */
export const notificationMemory = Duration.hours(24)

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const lock = yield* ChannelLock
  const access = yield* TwitchAccess
  const pause = yield* RewardPause
  const queue = yield* RedemptionQueue

  /**
   * Sets the Channel's state and the Reward's pause state to match. The
   * state is what later Redemptions are judged by, so it is stored first;
   * the pause update on Twitch is best effort, logged when it fails, since
   * a Twitch retry would not help and the next reconcile sets it again.
   */
  const setState = Effect.fn("ChannelReceive.setState")(function* (state: ChannelState) {
    yield* store.writeState(state)
    yield* Effect.logInfo(`The Channel is ${state}`)
    const reward = yield* store.readReward
    if (Option.isNone(reward)) {
      return
    }
    yield* Effect.flatMap(access.current, (grant) =>
      pause.applyState(grant, reward.value, state),
    ).pipe(observed, Effect.ignore)
  })

  /** Records why Twitch stopped delivering an Event Subscription the Channel holds; one it does not hold is not the Channel's to record. */
  const revoke = Effect.fn("ChannelReceive.revoke")(function* (
    subscriptionId: string,
    { reason }: Revocation,
  ) {
    const held = (yield* store.readEventSubscriptions).find(
      (subscription) => subscription.id === subscriptionId,
    )
    if (held === undefined) {
      return false
    }
    yield* store.updateEventSubscription({
      ...held,
      status: reason,
      revocationReason: Option.some(reason),
    })
    yield* Effect.logWarning(`Twitch revoked the ${held.type} Event Subscription: ${reason}`)
    return true
  })

  /** Queues a Redemption of the Reward for processing once this call has returned; one of any other reward is not the Channel's. */
  const enqueue = Effect.fnUntraced(function* (redemption: Redemption) {
    const reward = yield* store.readReward
    if (Option.isNone(reward) || reward.value.id !== redemption.rewardId) {
      return false
    }
    yield* queue.enqueue(redemption)
    return true
  })

  /** Acts on the event and says whether it was acted on, so only acted-on messages are remembered. */
  const act = (notification: Notification): Effect.Effect<boolean> => {
    const { event } = notification
    switch (event._tag) {
      case "StreamOnline":
        return Effect.as(setState("Live"), true)
      case "StreamOffline":
        return Effect.as(setState("Offline"), true)
      case "Revocation":
        return revoke(notification.subscriptionId, event)
      case "RedemptionAdded":
        return enqueue(event.redemption)
    }
  }

  const receive: ChannelReceiveService["receive"] = Effect.fn("ChannelReceive.receive")(
    function* (notification) {
      const now = yield* DateTime.now
      yield* store.forgetNotificationsBefore(DateTime.subtractDuration(now, notificationMemory))
      if (yield* store.hasSeenNotification(notification.messageId)) {
        yield* Effect.logInfo(`Notification ${notification.messageId} was already processed`)
        return
      }
      if (yield* act(notification)) {
        yield* store.recordNotification(notification.messageId, now)
      }
    },
    (self) => lock.withPermit(self),
    // Any notification is a chance to finish Redemptions left queued when the object last stopped.
    Effect.andThen(queue.kick),
  )

  return ChannelReceive.of({ receive })
})

/** The rules for a notification the receiver verified and handed over. */
export class ChannelReceive extends Context.Service<ChannelReceive, ChannelReceiveService>()(
  "@twitch-integrations/api/ChannelReceive",
) {
  static readonly layer: Layer.Layer<
    ChannelReceive,
    never,
    ChannelStore | ChannelLock | TwitchAccess | RewardPause | RedemptionQueue
  > = Layer.effect(ChannelReceive)(make)
}
