import * as Schema from "effect/Schema"

/**
 * One viewer's spend of channel points on a Reward, as Twitch reported it:
 * the Redemption's ID, the Reward it was spent on, who spent it, what they
 * typed, and when.
 */
export const Redemption = Schema.Struct({
  id: Schema.String,
  rewardId: Schema.String,
  viewerId: Schema.String,
  viewerName: Schema.String,
  input: Schema.String,
  redeemedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "Redemption" })
export type Redemption = typeof Redemption.Type

/**
 * Why a Redemption is held rather than ended. The spec names one reason,
 * the Twitch Connection having no token to cancel it with, and stores it
 * with the Redemption so a held row says why it is there.
 */
export const HoldReason = Schema.Literals(["TwitchUnavailable"]).annotate({
  identifier: "HoldReason",
})
export type HoldReason = typeof HoldReason.Type

/**
 * A Redemption that should have been cancelled but could not reach Twitch,
 * kept until the next reconcile settles it. The only stored Redemption
 * state after processing.
 */
export const HeldRedemption = Schema.Struct({
  redemption: Redemption,
  reason: HoldReason,
}).annotate({ identifier: "HeldRedemption" })
export type HeldRedemption = typeof HeldRedemption.Type
