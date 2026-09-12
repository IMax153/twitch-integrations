import * as Schema from "effect/Schema"

/**
 * The settings the deployment fixes for its Reward: what Twitch shows the
 * viewer and what a Redemption costs. Every other setting is a constant
 * below rather than a field, since none may vary.
 */
export const RewardSettings = Schema.Struct({
  title: Schema.String,
  cost: Schema.Int,
  prompt: Schema.String,
}).annotate({ identifier: "RewardSettings" })
export type RewardSettings = typeof RewardSettings.Type

/**
 * The Song Request Reward's settings. Changing a value here reaches the
 * channel on the next reconcile, without the Broadcaster reconnecting Twitch.
 */
export const songRequestSettings: RewardSettings = {
  title: "Song Request",
  cost: 1,
  prompt: "Paste a Spotify track link to add it to the queue.",
}

/**
 * The custom channel point reward the deployment owns on the Twitch channel:
 * its Twitch ID, the settings as last written, and the pause state the
 * deployment last set.
 */
export const Reward = Schema.Struct({
  id: Schema.String,
  ...RewardSettings.fields,
  isPaused: Schema.Boolean,
}).annotate({ identifier: "Reward" })
export type Reward = typeof Reward.Type

/** Whether a Reward's settings are the ones the spec fixes. */
export const hasSettings = (reward: Reward, settings: RewardSettings): boolean =>
  reward.title === settings.title &&
  reward.cost === settings.cost &&
  reward.prompt === settings.prompt
