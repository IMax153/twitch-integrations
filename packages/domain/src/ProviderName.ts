import * as Schema from "effect/Schema"

export const ProviderName = Schema.Literals(["spotify", "twitch"]).annotate({
  identifier: "ProviderName",
})
export type ProviderName = typeof ProviderName.Type
