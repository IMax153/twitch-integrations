import * as Schema from "effect/Schema"
import { ConnectedAccount } from "./ConnectedAccount.ts"
import { ConnectionStatus } from "./ConnectionStatus.ts"
import { ProviderName } from "./ProviderName.ts"

/**
 * What the Broadcaster Page shows for one Provider's Connection. Never
 * carries a token. The encoded form is plain JSON, which is also what crosses
 * the Durable Object RPC boundary.
 */
export const ConnectionSummary = Schema.Struct({
  provider: ProviderName,
  status: ConnectionStatus,
  /** Present once an authorization has completed. */
  connectedAccount: Schema.OptionFromNullOr(ConnectedAccount),
  /** The scopes the Provider granted; empty while Not Configured. */
  scopes: Schema.Array(Schema.String),
  /** When the current access token expires. */
  expiresAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
}).annotate({ identifier: "ConnectionSummary" })
export type ConnectionSummary = typeof ConnectionSummary.Type
export type ConnectionSummaryEncoded = typeof ConnectionSummary.Encoded
