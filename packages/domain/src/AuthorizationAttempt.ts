import * as Schema from "effect/Schema"
import { BroadcasterIdentity } from "./BroadcasterIdentity.ts"
import { ProviderName } from "./ProviderName.ts"

/**
 * A one-use record of a started Provider authorization, keyed by its random
 * state value and bound to the Broadcaster who started it.
 */
export const AuthorizationAttempt = Schema.Struct({
  state: Schema.String,
  provider: ProviderName,
  callbackUri: Schema.String,
  broadcaster: BroadcasterIdentity,
  createdAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
  consumed: Schema.Boolean,
}).annotate({ identifier: "AuthorizationAttempt" })
export type AuthorizationAttempt = typeof AuthorizationAttempt.Type
