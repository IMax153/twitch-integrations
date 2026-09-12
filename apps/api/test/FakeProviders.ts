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
  respondEmpty,
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

/**
 * Twitch serves its identity endpoint from its token host, so the whole
 * Provider scenario applies there, plus how the client credentials grant
 * answers: with the default app access token unless the scenario says
 * otherwise.
 */
export interface TwitchAuthScenario extends ProviderScenario {
  readonly appToken?: TokenEndpoint
}

/** The app access token the fake Twitch grants by client credentials and Helix accepts for Event Subscriptions. */
export const defaultAppAccessToken = "app-access-token"

/** A custom reward as the fake Helix holds it. */
export interface HelixRewardRecord {
  readonly id: string
  readonly title: string
  readonly cost: number
  readonly prompt: string
  readonly is_paused: boolean
}

/** An Event Subscription as the fake Helix holds it. */
export interface HelixEventSubscriptionRecord {
  readonly id: string
  readonly type: string
  readonly version: string
  readonly status: string
}

/**
 * How Twitch Helix answers: the user access token it accepts on the
 * Broadcaster's endpoints, the app access token it accepts on the EventSub
 * endpoints, and what the channel holds. Every field but the user token has
 * a default, so a test sets only what it is about.
 */
export interface TwitchHelixScenario extends WithLatency {
  readonly accessToken: Option.Option<string>
  readonly appAccessToken?: string
  /** The custom rewards this client ID may manage; none unless the test says so. */
  readonly manageableRewards?: ReadonlyArray<HelixRewardRecord>
  /** The ID Helix gives the next created reward. */
  readonly createdRewardId?: string
  /** The Event Subscriptions this client ID owns; none unless the test says so. */
  readonly eventSubscriptions?: ReadonlyArray<HelixEventSubscriptionRecord>
  /** Whether Get Streams reports the Broadcaster live. */
  readonly live?: boolean
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

const twitchTokenDialect: TokenDialect = {
  authenticated: (received) =>
    received.form["client_id"] === expectedCredentials.twitch.clientId &&
    received.form["client_secret"] === expectedCredentials.twitch.clientSecret,
  tokenType: "bearer",
  scope: (scopes) => scopes,
}

/** The grant an app access token request gets unless the scenario overrides it: a token that lasts for weeks. */
const defaultAppTokenGrant: TokenEndpoint = {
  _tag: "Grant",
  grant: {
    accessToken: defaultAppAccessToken,
    refreshToken: Option.none(),
    expiresIn: 5_000_000,
    scopes: Option.none(),
  },
}

const twitchUserToken = tokenEndpoint<TwitchAuthScenario>(twitchTokenDialect)

/** The client credentials grant answers from its own scenario field rather than the user grant. */
const twitchAppToken = tokenEndpoint<{ readonly token: TokenEndpoint }>(twitchTokenDialect)

const twitchAuth: FakeApiDefinition<TwitchAuthScenario> = {
  hostname: "id.twitch.tv",
  endpoints: {
    "POST /oauth2/token": (scenario, received) =>
      received.form["grant_type"] === "client_credentials"
        ? twitchAppToken({ token: scenario?.appToken ?? defaultAppTokenGrant }, received)
        : twitchUserToken(scenario, received),
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

/** The bearer token a Helix request carries, with the client ID header Helix requires. */
const helixBearer = (received: ReceivedRequest): string | undefined =>
  received.headers["client-id"] === expectedCredentials.twitch.clientId
    ? received.headers["authorization"]?.replace(/^Bearer /, "")
    : undefined

const unauthorized = respond(401, { error: "Unauthorized", status: 401 })

/** A Helix endpoint that needs the Broadcaster's user access token. */
const userEndpoint =
  (
    answer: (scenario: TwitchHelixScenario, received: ReceivedRequest) => FakeResponse,
  ): Endpoint<TwitchHelixScenario> =>
  (scenario, received) => {
    if (scenario === undefined) {
      return noScenario
    }
    const accepted = Option.getOrUndefined(scenario.accessToken)
    return accepted !== undefined && helixBearer(received) === accepted
      ? answer(scenario, received)
      : unauthorized
  }

/** A Helix endpoint that needs the app access token, as the EventSub endpoints do. */
const appEndpoint =
  (
    answer: (scenario: TwitchHelixScenario, received: ReceivedRequest) => FakeResponse,
  ): Endpoint<TwitchHelixScenario> =>
  (scenario, received) => {
    if (scenario === undefined) {
      return noScenario
    }
    return helixBearer(received) === (scenario.appAccessToken ?? defaultAppAccessToken)
      ? answer(scenario, received)
      : unauthorized
  }

const query = (received: ReceivedRequest) => new URL(received.url).searchParams

const asRecord = (json: unknown): Record<string, unknown> =>
  typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {}

/** The reward as a Helix update answers: the stored one with the body's fields laid over it. */
const updatedReward = (
  reward: HelixRewardRecord,
  body: Record<string, unknown>,
): HelixRewardRecord => ({
  id: reward.id,
  title: typeof body["title"] === "string" ? body["title"] : reward.title,
  cost: typeof body["cost"] === "number" ? body["cost"] : reward.cost,
  prompt: typeof body["prompt"] === "string" ? body["prompt"] : reward.prompt,
  is_paused: typeof body["is_paused"] === "boolean" ? body["is_paused"] : reward.is_paused,
})

/** The reward a create answers with before the body's fields are laid over it. */
const createdReward = (scenario: TwitchHelixScenario): HelixRewardRecord => ({
  id: scenario.createdRewardId ?? "reward-created",
  title: "",
  cost: 0,
  prompt: "",
  is_paused: false,
})

const twitchHelix: FakeApiDefinition<TwitchHelixScenario> = {
  hostname: "api.twitch.tv",
  endpoints: {
    "GET /helix/channel_points/custom_rewards": userEndpoint((scenario, received) =>
      query(received).get("only_manageable_rewards") === "true"
        ? respond(200, { data: scenario.manageableRewards ?? [] })
        : respond(400, { error: "Bad Request", message: "only manageable rewards are faked" }),
    ),
    "POST /helix/channel_points/custom_rewards": userEndpoint((scenario, received) =>
      respond(200, { data: [updatedReward(createdReward(scenario), asRecord(received.json))] }),
    ),
    "PATCH /helix/channel_points/custom_rewards": userEndpoint((scenario, received) => {
      const id = query(received).get("id")
      // A reward created earlier in the same scenario is manageable too.
      const known = [...(scenario.manageableRewards ?? []), createdReward(scenario)].find(
        (reward) => reward.id === id,
      )
      return known === undefined
        ? respond(404, { error: "Not Found" })
        : respond(200, { data: [updatedReward(known, asRecord(received.json))] })
    }),
    "GET /helix/eventsub/subscriptions": appEndpoint((scenario) =>
      respond(200, {
        data: scenario.eventSubscriptions ?? [],
        total: (scenario.eventSubscriptions ?? []).length,
        total_cost: 0,
        max_total_cost: 10000,
        pagination: {},
      }),
    ),
    "POST /helix/eventsub/subscriptions": appEndpoint((_scenario, received) => {
      const body = asRecord(received.json)
      const type = typeof body["type"] === "string" ? body["type"] : "unknown"
      return respond(202, {
        data: [
          {
            id: `created-${type}`,
            status: "webhook_callback_verification_pending",
            type,
            version: body["version"],
            condition: body["condition"],
            created_at: "2026-09-11T12:00:00Z",
            transport: { method: "webhook", callback: asRecord(body["transport"])["callback"] },
            cost: 0,
          },
        ],
        total: 1,
        total_cost: 0,
        max_total_cost: 10000,
      })
    }),
    "DELETE /helix/eventsub/subscriptions": appEndpoint((scenario, received) =>
      (scenario.eventSubscriptions ?? []).some(
        (subscription) => subscription.id === query(received).get("id"),
      )
        ? respondEmpty(204)
        : respond(404, { error: "Not Found" }),
    ),
    "GET /helix/streams": userEndpoint((scenario, received) =>
      respond(200, {
        data: scenario.live
          ? [
              {
                id: "stream-1",
                user_id: query(received).get("user_id"),
                type: "live",
                started_at: "2026-09-11T11:00:00Z",
              },
            ]
          : [],
        pagination: {},
      }),
    ),
  },
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
