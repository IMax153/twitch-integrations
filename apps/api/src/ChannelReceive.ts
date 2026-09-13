import type { ChannelState } from "@twitch-integrations/domain/ChannelState"
import { type ChatCommand, matchChatCommand } from "@twitch-integrations/domain/ChatCommand"
import type {
  ChatMessage,
  Notification,
  Revocation,
} from "@twitch-integrations/domain/Notification"
import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { logFailure, observed } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { Helix } from "./Helix.ts"
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

/**
 * What acting on a notification under the lock came to: whether the
 * Channel changed, and so the message ID is remembered, and what is owed
 * once the lock is free, which for an answered Invocation is the reply.
 */
interface Acted {
  readonly recorded: boolean
  readonly afterwards: Effect.Effect<void>
}

const ignored: Acted = { recorded: false, afterwards: Effect.void }
const recorded: Acted = { recorded: true, afterwards: Effect.void }

/** Whether the line reached this chat from another channel in a shared chat session. */
const fromAnotherChannel = (message: ChatMessage) =>
  Option.isSome(message.sourceBroadcasterUserId) &&
  message.sourceBroadcasterUserId.value !== message.broadcasterUserId

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const lock = yield* ChannelLock
  const access = yield* TwitchAccess
  const pause = yield* RewardPause
  const queue = yield* RedemptionQueue
  const helix = yield* Helix

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
      return ignored
    }
    yield* store.updateEventSubscription({
      ...held,
      status: reason,
      revocationReason: Option.some(reason),
    })
    yield* Effect.logWarning(`Twitch revoked the ${held.type} Event Subscription: ${reason}`)
    return recorded
  })

  /** Puts a Redemption of the Reward on the Processing Queue; one of any other reward is not the Channel's. */
  const enqueue = Effect.fnUntraced(function* (redemption: Redemption) {
    const reward = yield* store.readReward
    if (Option.isNone(reward) || reward.value.id !== redemption.rewardId) {
      return ignored
    }
    yield* queue.enqueue(redemption)
    return recorded
  })

  /**
   * Ends the Cooldown an answer started when the answer never reached chat,
   * so the next Invocation gets another chance. Under the lock, since the
   * Broadcaster may have edited or deleted the Chat Command meanwhile; an
   * edit has cleared the Cooldown already and a deletion leaves nothing.
   */
  const forgetAnswer = (name: string) =>
    lock.withPermit(
      Effect.flatMap(store.readChatCommand(name), (current) =>
        Option.isNone(current)
          ? Effect.void
          : store.writeChatCommand({ ...current.value, cooldownUntil: Option.none() }),
      ),
    )

  /**
   * Answers the Invocation in chat as the Twitch Connected Account, as a
   * threaded reply to the invoking message. A reply that cannot be sent,
   * because the Twitch Connection has no token to give or Twitch refused or
   * dropped it, is logged and its Cooldown forgotten: chat trouble never
   * costs the next viewer the reply.
   */
  const answer = Effect.fn("ChannelReceive.answer")(function* (
    command: ChatCommand,
    message: ChatMessage,
  ) {
    const sent = yield* Effect.flatMap(access.current, (grant) =>
      helix.sendChatMessage(grant.token, grant.account, command.response, {
        replyTo: message.messageId,
      }),
    ).pipe(Effect.tapError(logFailure), Effect.option)
    if (Option.isSome(sent) && sent.value.isSent) {
      yield* Effect.logInfo(`Answered !${command.name} for ${message.chatterDisplayName}`)
      return
    }
    const reason = Option.isNone(sent)
      ? "the reply could not be sent"
      : `Twitch dropped the reply: ${Option.getOrElse(sent.value.dropReason, () => "no reason given")}`
    yield* Effect.logWarning(
      `Forgot the !${command.name} answer for ${message.chatterDisplayName}: ${reason}`,
    )
    yield* forgetAnswer(command.name)
  })

  /**
   * Decides whether the chat line is an Invocation to answer. One from
   * another channel in shared chat, one naming no Chat Command, or one
   * naming a Disabled Chat Command or one in Cooldown is ignored without a
   * write, so chat volume never fills storage. Otherwise the answer is
   * stamped on the Chat Command now, under the lock, and sent once the lock
   * is free. Live and Offline are not consulted.
   */
  const invoke = Effect.fn("ChannelReceive.invoke")(function* (message: ChatMessage) {
    if (fromAnotherChannel(message)) {
      return ignored
    }
    const matched = matchChatCommand(message.text, yield* store.readChatCommands)
    if (Option.isNone(matched) || matched.value.status === "Disabled") {
      return ignored
    }
    const now = yield* DateTime.now
    const command = matched.value
    if (
      Option.isSome(command.cooldownUntil) &&
      DateTime.isGreaterThan(command.cooldownUntil.value, now)
    ) {
      return ignored
    }
    yield* store.writeChatCommand({
      ...command,
      cooldownUntil: Option.some(DateTime.addDuration(now, command.cooldown)),
      lastAnsweredAt: Option.some(now),
    })
    return { recorded: true, afterwards: answer(command, message) } satisfies Acted
  })

  /** Acts on the event and says what came of it, so only acted-on messages are remembered. */
  const act = (notification: Notification): Effect.Effect<Acted> => {
    const { event } = notification
    switch (event._tag) {
      case "StreamOnline":
        return Effect.as(setState("Live"), recorded)
      case "StreamOffline":
        return Effect.as(setState("Offline"), recorded)
      case "Revocation":
        return revoke(notification.subscriptionId, event)
      case "RedemptionAdded":
        return enqueue(event.redemption)
      case "ChatMessage":
        return invoke(event)
    }
  }

  /** Acts on the notification under the lock, once per message ID, and says what is owed afterwards. */
  const record = Effect.fn("ChannelReceive.record")(
    function* (notification: Notification) {
      const now = yield* DateTime.now
      yield* store.forgetNotificationsBefore(DateTime.subtractDuration(now, notificationMemory))
      if (yield* store.hasSeenNotification(notification.messageId)) {
        yield* Effect.logInfo(`Notification ${notification.messageId} was already processed`)
        return ignored
      }
      const acted = yield* act(notification)
      if (acted.recorded) {
        yield* store.recordNotification(notification.messageId, now)
      }
      return acted
    },
    (self) => lock.withPermit(self),
  )

  const receive: ChannelReceiveService["receive"] = Effect.fn("ChannelReceive.receive")(
    function* (notification) {
      const { afterwards } = yield* record(notification)
      // Once the lock is free: the Redemption just queued is processed, and
      // so are any left queued when the object last stopped.
      yield* queue.kick
      // A chat reply is sent before the receiver is acknowledged.
      yield* afterwards
    },
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
    ChannelStore | ChannelLock | TwitchAccess | RewardPause | RedemptionQueue | Helix
  > = Layer.effect(ChannelReceive)(make)
}
