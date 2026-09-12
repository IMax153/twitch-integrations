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
