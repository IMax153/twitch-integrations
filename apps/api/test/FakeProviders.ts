import type { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Ref from "effect/Ref"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { ProviderCredentials } from "../src/ProviderCredentials.ts"
import {
  type Endpoint,
  type FakeApiDefinition,
  type FakeApiService,
  type FakeResponse,
  type ReceivedRequest,
  type WithLatency,
  makeFakeApi,
  makeRequestLog,
  respond,
  routeByHostname,
} from "./FakeApi.ts"

/** The tokens a fake Provider hands out on a successful grant. */
export interface TokenGrant {
  readonly accessToken: string
  readonly refreshToken: Option.Option<string>
  readonly expiresIn: number
  readonly scopes: Option.Option<ReadonlyArray<string>>
}

/** How a fake Provider's token endpoint answers: with a grant, or by failing in one of the ways a real one can. */
export type TokenEndpoint =
  | { readonly _tag: "Grant"; readonly grant: TokenGrant }
  /** An error status with a JSON error body, as for a bad code, a rate limit, or an outage. */
  | { readonly _tag: "Status"; readonly status: number }
  /** The request never gets an answer. */
  | { readonly _tag: "Unreachable" }
  /** A 200 whose body is not a token response. */
  | { readonly _tag: "Malformed" }

/** How a fake Provider answers the next exchange and identity lookup, across both of its hosts. */
export interface ProviderScenario extends WithLatency {
  readonly token: TokenEndpoint
  readonly account: ConnectedAccount
}

/** Twitch serves its identity endpoint from its token host, so the whole Provider scenario applies there. */
export type TwitchAuthScenario = ProviderScenario

/** How Twitch Helix answers: the access token it accepts, or none while nothing has been granted. No endpoint is served yet. */
export interface TwitchHelixScenario extends WithLatency {
  readonly accessToken: Option.Option<string>
}

/** How Spotify's accounts host answers a token request. */
export interface SpotifyAccountsScenario extends WithLatency {
  readonly token: TokenEndpoint
}

/** How the Spotify Web API answers: the access token it accepts, or none while nothing has been granted, and whose account that is. */
export interface SpotifyWebScenario extends WithLatency {
  readonly accessToken: Option.Option<string>
  readonly account: ConnectedAccount
}

export interface FakeProvidersService {
  readonly twitchAuth: FakeApiService<TwitchAuthScenario>
  readonly twitchHelix: FakeApiService<TwitchHelixScenario>
  readonly spotifyAccounts: FakeApiService<SpotifyAccountsScenario>
  readonly spotifyWeb: FakeApiService<SpotifyWebScenario>
  /** Sets both of the Provider's fake APIs for one grant, from now on. */
  readonly set: (provider: ProviderName, scenario: ProviderScenario) => Effect.Effect<void>
  /** Every request any fake API has received, oldest first. */
  readonly received: Effect.Effect<ReadonlyArray<ReceivedRequest>>
}

/** The Credentials the fake Providers expect, with recognisable values so a test can spot them in a consent URL. */
const expectedCredentials: Record<ProviderName, { clientId: string; clientSecret: string }> = {
  spotify: { clientId: "spotify-client-id", clientSecret: "spotify-client-secret" },
  twitch: { clientId: "twitch-client-id", clientSecret: "twitch-client-secret" },
}

const credentials = Layer.succeed(ProviderCredentials, {
  spotify: {
    clientId: Redacted.make(expectedCredentials.spotify.clientId),
    clientSecret: Redacted.make(expectedCredentials.spotify.clientSecret),
  },
  twitch: {
    clientId: Redacted.make(expectedCredentials.twitch.clientId),
    clientSecret: Redacted.make(expectedCredentials.twitch.clientSecret),
  },
})

const basicAuthorization = (clientId: string, clientSecret: string) =>
  `Basic ${btoa(`${clientId}:${clientSecret}`)}`

const noScenario = respond(500, { error: "no scenario set" })

/** The grant a token endpoint hands out, or none when it answers any other way. */
const grantOf = (token: TokenEndpoint): Option.Option<TokenGrant> =>
  token._tag === "Grant" ? Option.some(token.grant) : Option.none()

/** How a token endpoint differs between Providers on the wire. */
interface TokenDialect {
  /** Whether a token request carries the Credentials the way this Provider expects. */
  readonly authenticated: (received: ReceivedRequest) => boolean
  readonly tokenType: string
  /** How this Provider reports granted scopes in a token response. */
  readonly scope: (scopes: ReadonlyArray<string>) => unknown
}

/** The token endpoint: checks the client authentication the Provider expects, then grants. */
const tokenEndpoint =
  <Scenario extends { readonly token: TokenEndpoint }>(dialect: TokenDialect): Endpoint<Scenario> =>
  (scenario, received) => {
    if (!dialect.authenticated(received)) {
      return respond(401, { error: "invalid_client" })
    }
    if (scenario === undefined) {
      return noScenario
    }
    const { token } = scenario
    switch (token._tag) {
      case "Grant":
        return respond(200, {
          access_token: token.grant.accessToken,
          token_type: dialect.tokenType,
          expires_in: token.grant.expiresIn,
          refresh_token: Option.getOrUndefined(token.grant.refreshToken),
          scope: Option.map(token.grant.scopes, dialect.scope).pipe(Option.getOrUndefined),
        })
      case "Status":
        return respond(token.status, { error: "invalid_grant" })
      case "Unreachable":
        return "unreachable"
      case "Malformed":
        return respond(200, { unexpected: true })
    }
  }

/** An identity endpoint: requires the accepted access token in the host's own `Authorization` scheme, and answers 401 while there is none. */
const identityEndpoint =
  <Scenario>(
    scheme: string,
    accepted: (scenario: Scenario) => Option.Option<{ accessToken: string; body: unknown }>,
  ): Endpoint<Scenario> =>
  (scenario, received): FakeResponse => {
    if (scenario === undefined) {
      return noScenario
    }
    return Option.match(accepted(scenario), {
      onNone: () => respond(401, { error: "invalid token" }),
      onSome: ({ accessToken, body }) =>
        received.headers["authorization"] === `${scheme} ${accessToken}`
          ? respond(200, body)
          : respond(401, { error: "invalid token" }),
    })
  }

const twitchAuth: FakeApiDefinition<TwitchAuthScenario> = {
  hostname: "id.twitch.tv",
  endpoints: {
    "POST /oauth2/token": tokenEndpoint({
      authenticated: (received) =>
        received.form["client_id"] === expectedCredentials.twitch.clientId &&
        received.form["client_secret"] === expectedCredentials.twitch.clientSecret,
      tokenType: "bearer",
      scope: (scopes) => scopes,
    }),
    "GET /oauth2/validate": identityEndpoint("OAuth", (scenario) =>
      Option.map(grantOf(scenario.token), (grant) => ({
        accessToken: grant.accessToken,
        body: {
          client_id: expectedCredentials.twitch.clientId,
          login: scenario.account.displayName,
          user_id: scenario.account.id,
          scopes: Option.getOrElse(grant.scopes, () => []),
          expires_in: grant.expiresIn,
        },
      })),
    ),
  },
}

const twitchHelix: FakeApiDefinition<TwitchHelixScenario> = {
  hostname: "api.twitch.tv",
  endpoints: {},
}

const spotifyAccounts: FakeApiDefinition<SpotifyAccountsScenario> = {
  hostname: "accounts.spotify.com",
  endpoints: {
    "POST /api/token": tokenEndpoint({
      authenticated: (received) =>
        received.headers["authorization"] ===
        basicAuthorization(
          expectedCredentials.spotify.clientId,
          expectedCredentials.spotify.clientSecret,
        ),
      tokenType: "Bearer",
      scope: (scopes) => scopes.join(" "),
    }),
  },
}

const spotifyWeb: FakeApiDefinition<SpotifyWebScenario> = {
  hostname: "api.spotify.com",
  endpoints: {
    "GET /v1/me": identityEndpoint("Bearer", (scenario) =>
      Option.map(scenario.accessToken, (accessToken) => ({
        accessToken,
        body: { id: scenario.account.id, display_name: scenario.account.displayName },
      })),
    ),
  },
}

const make = Effect.gen(function* () {
  const log = yield* makeRequestLog
  const apis = {
    twitchAuth: yield* makeFakeApi(twitchAuth, log),
    twitchHelix: yield* makeFakeApi(twitchHelix, log),
    spotifyAccounts: yield* makeFakeApi(spotifyAccounts, log),
    spotifyWeb: yield* makeFakeApi(spotifyWeb, log),
  }

  /** Fans a Provider's scenario out to its token host and to the API the granted token opens. */
  const set: FakeProvidersService["set"] = (provider, scenario) => {
    const accessToken = Option.map(grantOf(scenario.token), (grant) => grant.accessToken)
    const { latency } = scenario
    switch (provider) {
      case "twitch":
        return Effect.andThen(
          apis.twitchAuth.service.set(scenario),
          apis.twitchHelix.service.set({ accessToken, latency }),
        )
      case "spotify":
        return Effect.andThen(
          apis.spotifyAccounts.service.set({ token: scenario.token, latency }),
          apis.spotifyWeb.service.set({ accessToken, account: scenario.account, latency }),
        )
    }
  }

  const service: FakeProvidersService = {
    twitchAuth: apis.twitchAuth.service,
    twitchHelix: apis.twitchHelix.service,
    spotifyAccounts: apis.spotifyAccounts.service,
    spotifyWeb: apis.spotifyWeb.service,
    set,
    received: Ref.get(log.entries),
  }
  const client = routeByHostname(Object.values(apis), log)
  return { service, client }
})

/**
 * Fake Twitch and Spotify APIs, one per hostname, behind a closed
 * `HttpClient`, plus the control service a test sets scenarios on and reads
 * received requests from.
 */
export class FakeProviders extends Context.Service<FakeProviders, FakeProvidersService>()(
  "@twitch-integrations/api/test/FakeProviders",
) {
  /** The Provider Credentials the fake token endpoints accept. */
  static readonly layerCredentials: Layer.Layer<ProviderCredentials> = credentials
  /** Both the control service and the `HttpClient` routed to the fakes, built together. */
  static readonly layer: Layer.Layer<FakeProviders | HttpClient.HttpClient> = Layer.effectContext(
    Effect.map(make, ({ service, client }) =>
      Context.make(FakeProviders, service).pipe(Context.add(HttpClient.HttpClient, client)),
    ),
  )
}
