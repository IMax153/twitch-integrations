import * as Schema from "effect/Schema"

export const ProviderName = Schema.Literals(["spotify", "twitch"]).annotate({
  identifier: "ProviderName",
})
export type ProviderName = typeof ProviderName.Type

/** How each Provider is named to the Broadcaster. */
export const providerLabels: Record<ProviderName, string> = {
  spotify: "Spotify",
  twitch: "Twitch",
}
