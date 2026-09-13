import * as Schema from "effect/Schema"
import { Redemption } from "./Redemption.ts"

/** The Twitch Connected Account started streaming. */
export const StreamOnline = Schema.TaggedStruct("StreamOnline", {}).annotate({
  identifier: "StreamOnline",
})

/** The Twitch Connected Account stopped streaming. */
export const StreamOffline = Schema.TaggedStruct("StreamOffline", {}).annotate({
  identifier: "StreamOffline",
})

/** A viewer redeemed a custom reward on the channel; whether it is the Reward is for the Channel to decide. */
export const RedemptionAdded = Schema.TaggedStruct("RedemptionAdded", {
  redemption: Redemption,
}).annotate({ identifier: "RedemptionAdded" })

/** Twitch stopped delivering an Event Subscription, for the reason its status names. */
export const Revocation = Schema.TaggedStruct("Revocation", {
  reason: Schema.String,
}).annotate({ identifier: "Revocation" })
export type Revocation = typeof Revocation.Type

/**
 * One line of the channel's chat, as the Channel needs it to spot an
 * Invocation and answer it in a thread. `broadcasterUserId` is the channel
 * the Event Subscription watches, which the reconcile set to the Twitch
 * Connected Account; `sourceBroadcasterUserId` is the channel the line was
 * typed in when that is another channel in a shared chat session.
 */
export const ChatMessage = Schema.TaggedStruct("ChatMessage", {
  messageId: Schema.String,
  broadcasterUserId: Schema.String,
  chatterUserId: Schema.String,
  chatterLogin: Schema.String,
  chatterDisplayName: Schema.String,
  text: Schema.String,
  sourceBroadcasterUserId: Schema.OptionFromNullOr(Schema.String),
}).annotate({ identifier: "ChatMessage" })
export type ChatMessage = typeof ChatMessage.Type

export const NotificationEvent = Schema.Union([
  StreamOnline,
  StreamOffline,
  RedemptionAdded,
  Revocation,
  ChatMessage,
]).annotate({ identifier: "NotificationEvent" })
export type NotificationEvent = typeof NotificationEvent.Type

/**
 * One message Twitch delivered about the Channel and the receiver verified:
 * the message ID Twitch reuses when it resends, the Event Subscription it
 * came through, and what happened.
 */
export const Notification = Schema.Struct({
  messageId: Schema.String,
  subscriptionId: Schema.String,
  event: NotificationEvent,
}).annotate({ identifier: "Notification" })
export type Notification = typeof Notification.Type
/** The Notification as it crosses the Durable Object RPC: plain JSON, with the redemption time as a string. */
export type NotificationEncoded = typeof Notification.Encoded
