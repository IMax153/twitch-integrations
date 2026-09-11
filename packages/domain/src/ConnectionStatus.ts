import * as Schema from "effect/Schema"

export const ConnectionStatus = Schema.Literals([
  "Not Configured",
  "Authorized",
  "Reauthorization Required",
]).annotate({ identifier: "ConnectionStatus" })
export type ConnectionStatus = typeof ConnectionStatus.Type
