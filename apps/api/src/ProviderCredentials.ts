import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Redacted from "effect/Redacted"

/** One Provider's client ID and client secret. */
export interface Credentials {
  readonly clientId: Redacted.Redacted<string>
  readonly clientSecret: Redacted.Redacted<string>
}

export type ProviderCredentialsService = Record<ProviderName, Credentials>

const credentials = (clientId: string, clientSecret: string): Config.Config<Credentials> =>
  Config.all({ clientId: Config.Redacted(clientId), clientSecret: Config.Redacted(clientSecret) })

const config: Config.Config<ProviderCredentialsService> = Config.all({
  spotify: credentials("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"),
  twitch: credentials("TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"),
})

/** Config resolution cannot fail once the secrets are bound, so a miss is a deployment defect. */
const make = Effect.orDie(config)

/**
 * Both Providers' Credentials as redacted config. The Worker init yields
 * `config` so Alchemy registers the four values as Worker secrets; the
 * Connection object builds `layer` from the same config at runtime, where
 * Alchemy resolves it from the bound environment.
 */
export class ProviderCredentials extends Context.Service<
  ProviderCredentials,
  ProviderCredentialsService
>()("@twitch-integrations/api/ProviderCredentials") {
  static readonly config = config
  static readonly layer = Layer.effect(ProviderCredentials)(make)
}
