import * as Schema from "effect/Schema"
import { ConnectionStatus } from "./ConnectionStatus.ts"
import { ProviderName } from "./ProviderName.ts"

/** What the Operator Page shows for one Provider's Connection. */
export const ConnectionSummary = Schema.Struct({
  provider: ProviderName,
  status: ConnectionStatus,
}).annotate({ identifier: "ConnectionSummary" })
export type ConnectionSummary = typeof ConnectionSummary.Type
