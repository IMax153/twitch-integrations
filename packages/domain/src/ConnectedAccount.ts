import * as Schema from "effect/Schema"

/** The Provider-side account a Connection was authorized for. */
export const ConnectedAccount = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
}).annotate({ identifier: "ConnectedAccount" })
export type ConnectedAccount = typeof ConnectedAccount.Type
