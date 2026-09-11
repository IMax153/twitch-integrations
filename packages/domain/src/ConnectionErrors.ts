import * as Schema from "effect/Schema"
import { ProviderName } from "./ProviderName.ts"

/** The Provider has no Connection, so there is no token to hand out. */
export class ConnectionNotConfigured extends Schema.TaggedError<ConnectionNotConfigured>()(
  "ConnectionNotConfigured",
  { provider: ProviderName },
) {}

/** The Provider rejected the refresh token; the Broadcaster must authorize again. */
export class ReauthorizationRequired extends Schema.TaggedError<ReauthorizationRequired>()(
  "ReauthorizationRequired",
  { provider: ProviderName },
) {}
