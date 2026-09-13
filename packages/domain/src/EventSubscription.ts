import * as Schema from "effect/Schema"

/** The four kinds of notification the deployment asks Twitch EventSub for. */
export const EventSubscriptionType = Schema.Literals([
  "channel.channel_points_custom_reward_redemption.add",
  "stream.online",
  "stream.offline",
  "channel.chat.message",
]).annotate({ identifier: "EventSubscriptionType" })
export type EventSubscriptionType = typeof EventSubscriptionType.Type

/**
 * A registration with Twitch EventSub for one kind of notification about
 * the Channel, as Twitch last reported it, plus the reason Twitch gave when
 * it revoked the registration, if it has.
 */
export const EventSubscription = Schema.Struct({
  id: Schema.String,
  type: EventSubscriptionType,
  version: Schema.String,
  status: Schema.String,
  revocationReason: Schema.OptionFromNullOr(Schema.String),
}).annotate({ identifier: "EventSubscription" })
export type EventSubscription = typeof EventSubscription.Type
