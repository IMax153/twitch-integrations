import type { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

/** The tokens a fake Provider hands out on a successful grant. */
export interface TokenGrant {
  readonly accessToken: string
  readonly refreshToken: Option.Option<string>
  readonly expiresIn: number
  readonly scopes: Option.Option<ReadonlyArray<string>>
}

/** How a fake Provider answers the next exchange and identity lookup. */
export interface ProviderScenario {
  readonly grant: TokenGrant
  readonly account: ConnectedAccount
}

/** One request as the fake Provider saw it, with any form body decoded. */
export interface ReceivedRequest {
  readonly provider: ProviderName
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly form: Readonly<Record<string, string>>
}

export interface FakeProvidersService {
  /** Sets what the Provider answers from now on. */
  readonly set: (provider: ProviderName, scenario: ProviderScenario) => Effect.Effect<void>
  /** Every request the fake Providers have received, oldest first. */
  readonly received: Effect.Effect<ReadonlyArray<ReceivedRequest>>
}

/** The Credentials the fake Providers expect, matching the harness's fake config. */
const expectedCredentials: Record<ProviderName, { clientId: string; clientSecret: string }> = {
  spotify: { clientId: "spotify-client-id", clientSecret: "spotify-client-secret" },
  twitch: { clientId: "twitch-client-id", clientSecret: "twitch-client-secret" },
}

type Scenarios = Partial<Record<ProviderName, ProviderScenario>>

interface FakeResponse {
  readonly status: number
  readonly body: unknown
}

const respond = (status: number, body: unknown): FakeResponse => ({ status, body })

const decodeForm = (request: HttpClientRequest.HttpClientRequest): Record<string, string> =>
  request.body._tag === "Uint8Array"
    ? Object.fromEntries(new URLSearchParams(new TextDecoder().decode(request.body.body)))
    : {}

const basicAuthorization = (clientId: string, clientSecret: string) =>
  `Basic ${btoa(`${clientId}:${clientSecret}`)}`

/** The token endpoint: checks the client authentication the Provider expects, then grants. */
const tokenResponse = (
  provider: ProviderName,
  scenario: ProviderScenario | undefined,
  received: ReceivedRequest,
): FakeResponse => {
  const expected = expectedCredentials[provider]
  const authenticated =
    provider === "spotify"
      ? received.headers["authorization"] ===
        basicAuthorization(expected.clientId, expected.clientSecret)
      : received.form["client_id"] === expected.clientId &&
        received.form["client_secret"] === expected.clientSecret
  if (!authenticated) {
    return respond(401, { error: "invalid_client" })
  }
  if (scenario === undefined) {
    return respond(500, { error: "no scenario set" })
  }
  const { grant } = scenario
  const scopes = Option.getOrUndefined(grant.scopes)
  return respond(200, {
    access_token: grant.accessToken,
    token_type: provider === "spotify" ? "Bearer" : "bearer",
    expires_in: grant.expiresIn,
    refresh_token: Option.getOrUndefined(grant.refreshToken),
    // Spotify reports scopes space-separated, Twitch as an array.
    scope: scopes === undefined ? undefined : provider === "spotify" ? scopes.join(" ") : scopes,
  })
}

/** The identity endpoint: requires the granted access token in the Provider's own header style. */
const identityResponse = (
  provider: ProviderName,
  scenario: ProviderScenario | undefined,
  received: ReceivedRequest,
): FakeResponse => {
  if (scenario === undefined) {
    return respond(500, { error: "no scenario set" })
  }
  const scheme = provider === "spotify" ? "Bearer" : "OAuth"
  if (received.headers["authorization"] !== `${scheme} ${scenario.grant.accessToken}`) {
    return respond(401, { error: "invalid token" })
  }
  const { account } = scenario
  return provider === "spotify"
    ? respond(200, { id: account.id, display_name: account.displayName })
    : respond(200, {
        client_id: expectedCredentials.twitch.clientId,
        login: account.displayName,
        user_id: account.id,
        scopes: Option.getOrElse(scenario.grant.scopes, () => []),
        expires_in: scenario.grant.expiresIn,
      })
}

type Endpoint = (scenario: ProviderScenario | undefined, received: ReceivedRequest) => FakeResponse

/** The fake endpoints, keyed by the origin and path the real Providers use. */
const endpoints: Record<string, { provider: ProviderName; handle: Endpoint }> = {
  "POST https://accounts.spotify.com/api/token": {
    provider: "spotify",
    handle: (scenario, received) => tokenResponse("spotify", scenario, received),
  },
  "GET https://api.spotify.com/v1/me": {
    provider: "spotify",
    handle: (scenario, received) => identityResponse("spotify", scenario, received),
  },
  "POST https://id.twitch.tv/oauth2/token": {
    provider: "twitch",
    handle: (scenario, received) => tokenResponse("twitch", scenario, received),
  },
  "GET https://id.twitch.tv/oauth2/validate": {
    provider: "twitch",
    handle: (scenario, received) => identityResponse("twitch", scenario, received),
  },
}

const make = Effect.gen(function* () {
  const scenarios = yield* Ref.make<Scenarios>({})
  const log = yield* Ref.make<ReadonlyArray<ReceivedRequest>>([])

  const client = HttpClient.make((request, url) =>
    Effect.gen(function* () {
      const endpoint = endpoints[`${request.method} ${url.origin}${url.pathname}`]
      // NOTE: the transport is closed: anything but the known Provider
      // endpoints fails as if the network refused it, so no test can reach a
      // live Provider by accident.
      if (endpoint === undefined) {
        return yield* new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({
            request,
            cause: new Error(`Refused ${request.method} ${url.toString()}`),
          }),
        })
      }
      const received: ReceivedRequest = {
        provider: endpoint.provider,
        method: request.method,
        url: url.toString(),
        headers: { ...request.headers },
        form: decodeForm(request),
      }
      yield* Ref.update(log, (entries) => [...entries, received])
      const scenario = (yield* Ref.get(scenarios))[endpoint.provider]
      const { status, body } = endpoint.handle(scenario, received)
      return HttpClientResponse.fromWeb(request, Response.json(body, { status }))
    }),
  )

  const service: FakeProvidersService = {
    set: (provider, scenario) =>
      Ref.update(scenarios, (current) => ({ ...current, [provider]: scenario })),
    received: Ref.get(log),
  }
  return { service, client }
})

/**
 * Fake Spotify and Twitch token and identity endpoints behind a closed
 * `HttpClient`, plus the control service a test sets scenarios on and reads
 * received requests from.
 */
export class FakeProviders extends Context.Service<FakeProviders, FakeProvidersService>()(
  "@twitch-integrations/api/test/FakeProviders",
) {
  /** Both the control service and the `HttpClient` routed to the fakes, built together. */
  static readonly layer: Layer.Layer<FakeProviders | HttpClient.HttpClient> = Layer.effectContext(
    Effect.map(make, ({ service, client }) =>
      Context.make(FakeProviders, service).pipe(Context.add(HttpClient.HttpClient, client)),
    ),
  )
}
