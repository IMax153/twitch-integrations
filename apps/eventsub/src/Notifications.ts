import { EventSubscriptionType } from "@twitch-integrations/domain/EventSubscription"
import type { Notification, NotificationEvent } from "@twitch-integrations/domain/Notification"
import { Redemption } from "@twitch-integrations/domain/Redemption"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * A notification's body as Twitch sends it: which Event Subscription it
 * came through, and the event, read further only once the type is known.
 */
const NotificationBody = Schema.Struct({
  subscription: Schema.Struct({ id: Schema.String, type: Schema.String }).annotate({
    identifier: "NotificationSubscription",
  }),
  event: Schema.Unknown,
}).annotate({ identifier: "NotificationBody" })

/** A revocation's body: the Event Subscription Twitch stopped delivering, with the reason as its status. */
const RevocationBody = Schema.Struct({
  subscription: Schema.Struct({ id: Schema.String, status: Schema.String }).annotate({
    identifier: "RevokedSubscription",
  }),
}).annotate({ identifier: "RevocationBody" })

/** The redemption add event as Twitch sends it, read into a Redemption; the viewer's display name is the one shown in chat. */
const RedemptionAddEvent = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  user_name: Schema.String,
  user_input: Schema.String,
  reward: Schema.Struct({ id: Schema.String }).annotate({ identifier: "RedeemedReward" }),
  redeemed_at: Schema.String,
}).annotate({ identifier: "RedemptionAddEvent" })

const decodeNotificationBody = Schema.decodeUnknownOption(Schema.fromJsonString(NotificationBody))
const decodeRevocationBody = Schema.decodeUnknownOption(Schema.fromJsonString(RevocationBody))
const decodeType = Schema.decodeUnknownOption(EventSubscriptionType)
const decodeRedemptionAdd = Schema.decodeUnknownOption(RedemptionAddEvent)
const decodeRedeemedAt = Schema.decodeUnknownOption(Redemption.fields.redeemedAt)

/** The event of a notification of a known type, or none when the body is not the event that type carries. */
const eventOf = (type: EventSubscriptionType, event: unknown): Option.Option<NotificationEvent> => {
  switch (type) {
    case "stream.online":
      return Option.some({ _tag: "StreamOnline" })
    case "stream.offline":
      return Option.some({ _tag: "StreamOffline" })
    case "channel.channel_points_custom_reward_redemption.add":
      return Option.flatMap(decodeRedemptionAdd(event), (wire) =>
        Option.map(decodeRedeemedAt(wire.redeemed_at), (redeemedAt) => ({
          _tag: "RedemptionAdded",
          redemption: {
            id: wire.id,
            rewardId: wire.reward.id,
            viewerId: wire.user_id,
            viewerName: wire.user_name,
            input: wire.user_input,
            redeemedAt,
          },
        })),
      )
  }
}

/** What the receiver made of a message body. */
export type Parsed =
  /** A notification for the Channel. */
  | { readonly _tag: "Forward"; readonly notification: Notification }
  /** A notification of a type the deployment never asked for, acknowledged without reaching the Channel. */
  | { readonly _tag: "UnknownType"; readonly type: string }
  /** A body that is not what the message type says it is. */
  | { readonly _tag: "Malformed" }

const malformed: Parsed = { _tag: "Malformed" }

/** A notification body, parsed for the Channel once its subscription type is one of the three the deployment keeps. */
export const parseNotification = (messageId: string, body: string): Parsed =>
  Option.match(decodeNotificationBody(body), {
    onNone: () => malformed,
    onSome: ({ subscription, event }) =>
      Option.match(decodeType(subscription.type), {
        onNone: (): Parsed => ({ _tag: "UnknownType", type: subscription.type }),
        onSome: (type) =>
          Option.match(eventOf(type, event), {
            onNone: () => malformed,
            onSome: (event): Parsed => ({
              _tag: "Forward",
              notification: { messageId, subscriptionId: subscription.id, event },
            }),
          }),
      }),
  })

/** A revocation body, parsed for the Channel with the subscription's status as the reason. */
export const parseRevocation = (messageId: string, body: string): Parsed =>
  Option.match(decodeRevocationBody(body), {
    onNone: () => malformed,
    onSome: ({ subscription }) => ({
      _tag: "Forward",
      notification: {
        messageId,
        subscriptionId: subscription.id,
        event: { _tag: "Revocation", reason: subscription.status },
      },
    }),
  })
