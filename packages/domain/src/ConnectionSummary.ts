import * as Schema from "effect/Schema"
import { ConnectedAccount } from "./ConnectedAccount.ts"
import { ConnectionStatus } from "./ConnectionStatus.ts"
import { ProviderName } from "./ProviderName.ts"
import { RefreshError } from "./RefreshError.ts"

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
  /** When the next scheduled refresh runs; absent while none is scheduled. */
  nextRefreshAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
  /** Why the most recent refresh failed, until one succeeds. */
  lastRefreshError: Schema.OptionFromNullOr(RefreshError),
}).annotate({ identifier: "ConnectionSummary" })
export type ConnectionSummary = typeof ConnectionSummary.Type
export type ConnectionSummaryEncoded = typeof ConnectionSummary.Encoded
