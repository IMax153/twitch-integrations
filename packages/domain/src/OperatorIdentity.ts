import * as Schema from "effect/Schema"

/** The Cloudflare Access identity of the Operator, as the Access context reports it. */
export const OperatorIdentity = Schema.Struct({
  userUuid: Schema.String,
  email: Schema.String,
}).annotate({ identifier: "OperatorIdentity" })
export type OperatorIdentity = typeof OperatorIdentity.Type
