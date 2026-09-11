import * as Schema from "effect/Schema"

/** The Cloudflare Access identity of the Broadcaster, as the Access context reports it. */
export const BroadcasterIdentity = Schema.Struct({
  userUuid: Schema.String,
  email: Schema.String,
}).annotate({ identifier: "BroadcasterIdentity" })
export type BroadcasterIdentity = typeof BroadcasterIdentity.Type
