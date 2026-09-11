import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Credentials, ProviderCredentials } from "./ProviderCredentials.ts"

/**
 * How a Provider expects the client ID and secret on a token request:
 * `basic` sends them as HTTP Basic credentials, `body` puts them in the form.
 */
export type ClientAuthentication = "basic" | "body"

/** What distinguishes one Provider's OAuth deployment from another's. */
export interface ProviderDescription {
  readonly name: ProviderName
  readonly authorizeUrl: string
  readonly tokenEndpoint: string
  readonly clientAuthentication: ClientAuthentication
  readonly scopes: ReadonlyArray<string>
  readonly identityEndpoint: string
}

export interface ProviderService extends ProviderDescription {
  readonly credentials: Credentials
}

// NOTE: the scope lists are the deployment's own choice; the spec's reference
// lists were discarded with the document that held them. Widening a list
// only takes effect on the next Connect.
export const spotify: ProviderDescription = {
  name: "spotify",
  authorizeUrl: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
  clientAuthentication: "basic",
  scopes: ["user-read-currently-playing", "user-read-playback-state"],
  identityEndpoint: "https://api.spotify.com/v1/me",
}

export const twitch: ProviderDescription = {
  name: "twitch",
  authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
  tokenEndpoint: "https://id.twitch.tv/oauth2/token",
  clientAuthentication: "body",
  scopes: ["channel:read:redemptions", "channel:manage:redemptions", "chat:read", "chat:edit"],
  identityEndpoint: "https://id.twitch.tv/oauth2/validate",
}

const descriptions: Record<ProviderName, ProviderDescription> = { spotify, twitch }

/**
 * The one Provider a Connection object talks to. Each object hosts one
 * Provider, so the layer is chosen by name when the object is built.
 */
export class Provider extends Context.Service<Provider, ProviderService>()(
  "@twitch-integrations/api/Provider",
) {
  static readonly layer = (name: ProviderName): Layer.Layer<Provider, never, ProviderCredentials> =>
    Layer.effect(Provider)(
      Effect.map(ProviderCredentials, (credentials) => ({
        ...descriptions[name],
        credentials: credentials[name],
      })),
    )
}
