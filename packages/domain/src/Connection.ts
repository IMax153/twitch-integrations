import * as Schema from "effect/Schema"
import { ConnectedAccount } from "./ConnectedAccount.ts"
import { ConnectionStatus } from "./ConnectionStatus.ts"

/**
 * A token the Provider issued. Redacted in memory so it never prints; encoded
 * as the plain string only at the storage boundary.
 */
const Token = Schema.RedactedFromValue(Schema.String).annotate({ identifier: "Token" })

/**
 * The one stored account authorization for a Provider. The encoded form is
 * plain JSON: tokens as strings, times as ISO 8601, absent values as null.
 */
export const Connection = Schema.Struct({
  accessToken: Token,
  refreshToken: Schema.OptionFromNullOr(Token),
  scopes: Schema.Array(Schema.String),
  tokenType: Schema.String,
  expiresAt: Schema.DateTimeUtcFromString,
  status: ConnectionStatus,
  refreshRetryCount: Schema.Int,
  nextRefreshAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
  lastRefreshError: Schema.OptionFromNullOr(Schema.String),
  connectedAccount: ConnectedAccount,
}).annotate({ identifier: "Connection" })
export type Connection = typeof Connection.Type
