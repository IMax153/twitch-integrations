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

/** Why a Redemption is held rather than ended: the Twitch Connection could not hand out a token to cancel it with. */
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
