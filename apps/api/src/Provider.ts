import { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import { type ProviderName, providerLabels } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { type Credentials, ProviderCredentials } from "./ProviderCredentials.ts"

/**
 * How a Provider expects the client ID and secret on a token request:
 * `basic` sends them as HTTP Basic credentials, `body` puts them in the form.
 */
export type ClientAuthentication = "basic" | "body"

/** The `Authorization` scheme a Provider's identity endpoint expects the access token under. */
export type IdentityScheme = "Bearer" | "OAuth"

/** What distinguishes one Provider's OAuth deployment from another's. */
export interface ProviderDescription {
  readonly name: ProviderName
  readonly authorizeUrl: string
  readonly tokenEndpoint: string
  readonly clientAuthentication: ClientAuthentication
  readonly scopes: ReadonlyArray<string>
  readonly identityEndpoint: string
  readonly identityScheme: IdentityScheme
  /** Reads the Connected Account out of the identity endpoint's JSON body. */
  readonly decodeConnectedAccount: (
    body: unknown,
  ) => Effect.Effect<ConnectedAccount, Schema.SchemaError>
}

/** A token response as the Provider issued it, in one shape for both Providers. */
export interface TokenResponse {
  readonly accessToken: Redacted.Redacted<string>
  readonly tokenType: string
  readonly expiresIn: Duration.Duration
  /** Absent when the Provider chose not to rotate the refresh token. */
  readonly refreshToken: Option.Option<Redacted.Redacted<string>>
  /** Absent when the Provider left the granted scopes out of the response. */
  readonly scopes: Option.Option<ReadonlyArray<string>>
}

export type ProviderOperation = "exchange" | "refresh" | "identity" | "client-credentials"

/** Why a request to the Provider did not produce what it should have. */
export type ProviderFailureReason =
  /** The request never got an answer. */
  | { readonly _tag: "Transport" }
  /** The Provider answered with an error status. */
  | { readonly _tag: "Status"; readonly status: number }
  /** The Provider answered, but the body was not what it should be. */
  | { readonly _tag: "Body" }

/**
 * A request to the Provider failed. Carries only what the failure was, never
 * the underlying request or response: those hold the Credentials and access
 * token, and this error may end up in a log.
 */
export class ProviderRequestFailed extends Data.TaggedError("ProviderRequestFailed")<{
  readonly provider: ProviderName
  readonly operation: ProviderOperation
  readonly reason: ProviderFailureReason
}> {}

/**
 * Whether the Provider turned the request itself down, as opposed to being
 * unreachable, rate limiting, or failing on its own side: any client error
 * other than a rate limit. For a refresh, this means the refresh token is
 * no good.
 */
export const isClientRejection = (failure: ProviderRequestFailed): boolean =>
  failure.reason._tag === "Status" &&
  failure.reason.status >= 400 &&
  failure.reason.status < 500 &&
  failure.reason.status !== 429

/**
 * Whether the failure is the kind a short wait tends to cure: the Provider
 * could not be reached, or asked for a pause.
 */
export const isMomentary = (failure: ProviderRequestFailed): boolean =>
  failure.reason._tag === "Transport" ||
  (failure.reason._tag === "Status" && failure.reason.status === 429)

/** The failure in words for the Broadcaster Page: which Provider, which request, and what came of it. */
export const describeFailure = (failure: ProviderRequestFailed): string => {
  const subject = `${providerLabels[failure.provider]} ${failure.operation} request`
  switch (failure.reason._tag) {
    case "Transport":
      return `The ${subject} got no answer.`
    case "Status":
      return `The ${subject} was answered with status ${failure.reason.status}.`
    case "Body":
      return `The ${subject} was answered with an unexpected body.`
  }
}

/** What a failed HTTP call to a Provider amounts to, with the request and response left behind. */
export const failureReason = (
  cause: HttpClientError.HttpClientError | Schema.SchemaError,
): ProviderFailureReason => {
  if (cause._tag === "SchemaError") {
    return { _tag: "Body" }
  }
  switch (cause.reason._tag) {
    case "StatusCodeError":
      return { _tag: "Status", status: cause.reason.response.status }
    case "DecodeError":
    case "EmptyBodyError":
      return { _tag: "Body" }
    default:
      return { _tag: "Transport" }
  }
}

/**
 * The Provider's own account of a refused request, read from the error
 * body with the given reader, or none when the failure was not a refusal or
 * the body carried none. Shared by the Helix and Spotify clients, whose
 * error bodies differ only in shape.
 */
export const refusalDetail =
  (
    readDetail: (
      response: HttpClientResponse.HttpClientResponse,
    ) => Effect.Effect<string, HttpClientError.HttpClientError | Schema.SchemaError>,
  ) =>
  (
    cause: HttpClientError.HttpClientError | Schema.SchemaError,
  ): Effect.Effect<Option.Option<string>> =>
    cause._tag === "HttpClientError" && cause.reason._tag === "StatusCodeError"
      ? readDetail(cause.reason.response).pipe(
          Effect.map(Option.some),
          Effect.orElseSucceed(Option.none),
        )
      : Effect.succeed(Option.none())

export interface ProviderService extends ProviderDescription {
  readonly credentials: Credentials
  /** Submits the authorization code grant; the callback URI must match the one consent was started with. */
  readonly exchangeCode: (
    code: string,
    callbackUri: string,
  ) => Effect.Effect<TokenResponse, ProviderRequestFailed>
  /** Submits the refresh token grant for a new access token. */
  readonly refresh: (
    refreshToken: Redacted.Redacted<string>,
  ) => Effect.Effect<TokenResponse, ProviderRequestFailed>
  /**
   * Submits the client credentials grant for an app access token: a token
   * for the application itself rather than for the Connected Account. Twitch
   * requires one to manage Event Subscriptions.
   */
  readonly requestClientCredentials: Effect.Effect<TokenResponse, ProviderRequestFailed>
  /** Asks the Provider which account the access token belongs to. */
  readonly fetchConnectedAccount: (
    accessToken: Redacted.Redacted<string>,
  ) => Effect.Effect<ConnectedAccount, ProviderRequestFailed>
}

/** Spotify's current user profile; a display name may be unset on the account. */
const SpotifyProfile = Schema.Struct({
  id: Schema.String,
  display_name: Schema.String.pipe(Schema.NullOr, Schema.optional),
}).annotate({ identifier: "SpotifyProfile" })

/** Twitch's token validation, which reports the token's owner. */
const TwitchValidation = Schema.Struct({
  user_id: Schema.String,
  login: Schema.String,
}).annotate({ identifier: "TwitchValidation" })

const decodeSpotifyProfile = Schema.decodeUnknownEffect(SpotifyProfile)
const decodeTwitchValidation = Schema.decodeUnknownEffect(TwitchValidation)

// NOTE: widening a scope list only takes effect on the next authorization.
export const spotify: ProviderDescription = {
  name: "spotify",
  authorizeUrl: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
  clientAuthentication: "basic",
  scopes: ["user-modify-playback-state", "user-read-playback-state", "user-read-currently-playing"],
  identityEndpoint: "https://api.spotify.com/v1/me",
  identityScheme: "Bearer",
  decodeConnectedAccount: (body) =>
    Effect.map(decodeSpotifyProfile(body), (profile) => ({
      id: profile.id,
      displayName: profile.display_name ?? profile.id,
    })),
}

export const twitch: ProviderDescription = {
  name: "twitch",
  authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
  tokenEndpoint: "https://id.twitch.tv/oauth2/token",
  clientAuthentication: "body",
  scopes: [
    "channel:read:redemptions",
    "channel:manage:redemptions",
    "user:read:chat",
    "user:write:chat",
    "moderator:manage:shoutouts",
  ],
  identityEndpoint: "https://id.twitch.tv/oauth2/validate",
  identityScheme: "OAuth",
  decodeConnectedAccount: (body) =>
    Effect.map(decodeTwitchValidation(body), (validation) => ({
      id: validation.user_id,
      displayName: validation.login,
    })),
}

const descriptions: Record<ProviderName, ProviderDescription> = { spotify, twitch }

/**
 * A token response on the wire. Spotify reports the granted scopes as one
 * space-separated string and Twitch as an array; both are accepted here.
 */
const TokenResponseWire = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Finite,
  refresh_token: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
}).annotate({ identifier: "TokenResponseWire" })

const scopeList = (scope: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof scope === "string" ? scope.split(" ").filter((entry) => entry !== "") : scope

const tokenResponse = (wire: typeof TokenResponseWire.Type): TokenResponse => ({
  accessToken: Redacted.make(wire.access_token),
  tokenType: wire.token_type,
  expiresIn: Duration.seconds(wire.expires_in),
  refreshToken: Option.fromUndefinedOr(wire.refresh_token).pipe(Option.map(Redacted.make)),
  scopes: Option.fromUndefinedOr(wire.scope).pipe(Option.map(scopeList)),
})

const readTokenResponse = HttpClientResponse.schemaBodyJson(TokenResponseWire)

const make = Effect.fnUntraced(function* (name: ProviderName) {
  const description = descriptions[name]
  const credentials = (yield* ProviderCredentials)[name]
  // Any status outside 2xx is a failed request; the error keeps the response.
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)

  const failed =
    (operation: ProviderOperation) =>
    (cause: HttpClientError.HttpClientError | Schema.SchemaError): ProviderRequestFailed =>
      new ProviderRequestFailed({ provider: name, operation, reason: failureReason(cause) })

  /** Applies the Provider's client authentication style to a token request. */
  const authenticate = (
    request: HttpClientRequest.HttpClientRequest,
    form: Record<string, string>,
  ): HttpClientRequest.HttpClientRequest =>
    description.clientAuthentication === "basic"
      ? request.pipe(
          HttpClientRequest.basicAuth(credentials.clientId, credentials.clientSecret),
          HttpClientRequest.bodyUrlParams(form),
        )
      : HttpClientRequest.bodyUrlParams(request, {
          ...form,
          client_id: Redacted.value(credentials.clientId),
          client_secret: Redacted.value(credentials.clientSecret),
        })

  /** Submits one grant to the token endpoint and reads the token response. */
  const requestTokens = Effect.fn("Provider.requestTokens")(function* (
    operation: ProviderOperation,
    form: Record<string, string>,
  ) {
    const request = authenticate(HttpClientRequest.post(description.tokenEndpoint), form)
    const response = yield* client
      .execute(request)
      .pipe(Effect.flatMap(readTokenResponse), Effect.mapError(failed(operation)))
    return tokenResponse(response)
  })

  const service: ProviderService = {
    ...description,
    credentials,
    exchangeCode: (code, callbackUri) =>
      requestTokens("exchange", {
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUri,
      }),
    refresh: (refreshToken) =>
      requestTokens("refresh", {
        grant_type: "refresh_token",
        refresh_token: Redacted.value(refreshToken),
      }),
    requestClientCredentials: requestTokens("client-credentials", {
      grant_type: "client_credentials",
    }),
    fetchConnectedAccount: Effect.fn("Provider.fetchConnectedAccount")(
      function* (accessToken: Redacted.Redacted<string>) {
        const request = HttpClientRequest.get(description.identityEndpoint).pipe(
          HttpClientRequest.setHeader(
            "authorization",
            `${description.identityScheme} ${Redacted.value(accessToken)}`,
          ),
        )
        const response = yield* client.execute(request)
        return yield* description.decodeConnectedAccount(yield* response.json)
      },
      Effect.mapError(failed("identity")),
    ),
  }
  return service
})

/**
 * The one Provider a Connection object talks to. Each object hosts one
 * Provider, so the layer is chosen by name when the object is built.
 */
export class Provider extends Context.Service<Provider, ProviderService>()(
  "@twitch-integrations/api/Provider",
) {
  static readonly layer = (
    name: ProviderName,
  ): Layer.Layer<Provider, never, ProviderCredentials | HttpClient.HttpClient> =>
    Layer.effect(Provider)(make(name))
}
