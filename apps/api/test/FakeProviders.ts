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

/** How one fake Provider differs from the other on the wire. */
interface FakeProvider {
  readonly tokenEndpoint: string
  readonly identityEndpoint: string
  /** Whether a token request carries the Credentials the way this Provider expects. */
  readonly authenticated: (received: ReceivedRequest) => boolean
  readonly tokenType: string
  /** How this Provider reports granted scopes in a token response. */
  readonly scope: (scopes: ReadonlyArray<string>) => unknown
  /** The `Authorization` scheme the identity endpoint expects. */
  readonly identityScheme: string
  readonly identityBody: (scenario: ProviderScenario) => unknown
}

const basicAuthorization = (clientId: string, clientSecret: string) =>
  `Basic ${btoa(`${clientId}:${clientSecret}`)}`

const fakeProviders: Record<ProviderName, FakeProvider> = {
  spotify: {
    tokenEndpoint: "https://accounts.spotify.com/api/token",
    identityEndpoint: "https://api.spotify.com/v1/me",
    authenticated: (received) =>
      received.headers["authorization"] ===
      basicAuthorization(
        expectedCredentials.spotify.clientId,
        expectedCredentials.spotify.clientSecret,
      ),
    tokenType: "Bearer",
    scope: (scopes) => scopes.join(" "),
    identityScheme: "Bearer",
    identityBody: ({ account }) => ({ id: account.id, display_name: account.displayName }),
  },
  twitch: {
    tokenEndpoint: "https://id.twitch.tv/oauth2/token",
    identityEndpoint: "https://id.twitch.tv/oauth2/validate",
    authenticated: (received) =>
      received.form["client_id"] === expectedCredentials.twitch.clientId &&
      received.form["client_secret"] === expectedCredentials.twitch.clientSecret,
    tokenType: "bearer",
    scope: (scopes) => scopes,
    identityScheme: "OAuth",
    identityBody: ({ account, grant }) => ({
      client_id: expectedCredentials.twitch.clientId,
      login: account.displayName,
      user_id: account.id,
      scopes: Option.getOrElse(grant.scopes, () => []),
      expires_in: grant.expiresIn,
    }),
  },
}

/** The token endpoint: checks the client authentication the Provider expects, then grants. */
const tokenResponse = (
  fake: FakeProvider,
  scenario: ProviderScenario | undefined,
  received: ReceivedRequest,
): FakeResponse => {
  if (!fake.authenticated(received)) {
    return respond(401, { error: "invalid_client" })
  }
  if (scenario === undefined) {
    return respond(500, { error: "no scenario set" })
  }
  const { grant } = scenario
  return respond(200, {
    access_token: grant.accessToken,
    token_type: fake.tokenType,
    expires_in: grant.expiresIn,
    refresh_token: Option.getOrUndefined(grant.refreshToken),
    scope: Option.map(grant.scopes, fake.scope).pipe(Option.getOrUndefined),
  })
}

/** The identity endpoint: requires the granted access token in the Provider's own header style. */
const identityResponse = (
  fake: FakeProvider,
  scenario: ProviderScenario | undefined,
  received: ReceivedRequest,
): FakeResponse => {
  if (scenario === undefined) {
    return respond(500, { error: "no scenario set" })
  }
  if (
    received.headers["authorization"] !== `${fake.identityScheme} ${scenario.grant.accessToken}`
  ) {
    return respond(401, { error: "invalid token" })
  }
  return respond(200, fake.identityBody(scenario))
}

interface Endpoint {
  readonly provider: ProviderName
  readonly handle: (
    scenario: ProviderScenario | undefined,
    received: ReceivedRequest,
  ) => FakeResponse
}

/** The fake endpoints, keyed by method, origin, and path as the real Providers expose them. */
const endpoints: Record<string, Endpoint> = Object.fromEntries(
  (Object.keys(fakeProviders) as ReadonlyArray<ProviderName>).flatMap((provider) => {
    const fake = fakeProviders[provider]
    return [
      [
        `POST ${fake.tokenEndpoint}`,
        { provider, handle: (scenario, received) => tokenResponse(fake, scenario, received) },
      ],
      [
        `GET ${fake.identityEndpoint}`,
        { provider, handle: (scenario, received) => identityResponse(fake, scenario, received) },
      ],
    ] satisfies ReadonlyArray<readonly [string, Endpoint]>
  }),
)

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
