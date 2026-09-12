import * as Schema from "effect/Schema"

/**
 * Whether the Twitch Connected Account is streaming. There is no third
 * value: a Channel that does not yet know is Offline.
 */
export const ChannelState = Schema.Literals(["Live", "Offline"]).annotate({
  identifier: "ChannelState",
})
export type ChannelState = typeof ChannelState.Type
