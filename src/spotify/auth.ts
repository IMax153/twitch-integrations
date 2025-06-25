import {
  FileSystem,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Path,
  UrlParams
} from "@effect/platform"
import { Clock, Config, Effect, Predicate, Redacted, Schedule, Schema, Struct, SynchronizedRef } from "effect"

export class SpotifyAccessToken extends Schema.Class<SpotifyAccessToken>(
  "app/Spotify/Auth/SpotifyAccessToken"
)({
  tokenType: Schema.Literal("Bearer").pipe(
    Schema.propertySignature,
    Schema.fromKey("token_type")
  ),
  accessToken: Schema.Redacted(Schema.NonEmptyString).pipe(
    Schema.propertySignature,
    Schema.fromKey("access_token")
  ),
  refreshToken: Schema.Redacted(Schema.NonEmptyString).pipe(
    Schema.propertySignature,
    Schema.fromKey("refresh_token")
  ),
  expiresIn: Schema.Int.pipe(
    Schema.propertySignature,
    Schema.fromKey("expires_in")
  ),
  scope: Schema.split(" ")
}) {}

export class SpotifyRefreshToken extends Schema.Class<SpotifyRefreshToken>(
  "app/Spotify/Auth/RefreshToken"
)({
  ...SpotifyAccessToken.fields,
  refreshToken: Schema.Redacted(Schema.NonEmptyString).pipe(
    Schema.optional,
    Schema.fromKey("refresh_token")
  )
}) {}

export class AccessToken extends Schema.Class<AccessToken>(
  "app/Spotify/Auth/AccessToken"
)({
  ...SpotifyAccessToken.fields,
  createdAt: Schema.Int
}) {
  static fromJson = Schema.decode(Schema.parseJson(this))
  static toJson = Schema.encode(Schema.parseJson(this))

  isExpired(now: number): boolean {
    return this.createdAt + (this.expiresIn * 1000) <= now
  }
}

export const AccessTokenFromAuthorizationCode = Schema.transformOrFail(
  SpotifyAccessToken,
  Schema.typeSchema(AccessToken),
  {
    strict: true,
    decode: (encoded) =>
      Effect.map(Clock.currentTimeMillis, (createdAt) =>
        new AccessToken({
          ...encoded,
          createdAt
        }, { disableValidation: true })),
    encode: (decoded) => Effect.succeed(Struct.omit("createdAt")(decoded))
  }
)

export class SpotifyAuth extends Effect.Service<SpotifyAuth>()("app/Spotify/Auth", {
  scoped: Effect.gen(function*() {
    const baseUrl = yield* Config.url("SPOTIFY_ACCOUNTS_BASE_URL")
    const redirectUri = yield* Config.string("SPOTIFY_OAUTH2_REDIRECT_URI")
    const clientId = yield* Config.string("SPOTIFY_CLIENT_ID")
    const clientSecret = yield* Config.redacted("SPOTIFY_CLIENT_SECRET")
    const authCode = yield* Config.redacted("SPOTIFY_AUTHORIZATION_CODE")

    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const cachedTokensDir = "/persist/spotify/tokens"
    const cachedTokenPath = path.join(cachedTokensDir, "token.json")

    yield* fs.makeDirectory(cachedTokensDir, { recursive: true }).pipe(
      Effect.whenEffect(Effect.map(fs.exists(cachedTokensDir), (exists) => !exists)),
      Effect.orDie
    )

    const readTokenFromCache = Effect.fn("SpotifyAuth.readTokenFromCache")(
      function*() {
        const json = yield* fs.readFileString(cachedTokenPath, "utf-8")
        return yield* AccessToken.fromJson(json)
      }
    )

    const writeTokenToCache = Effect.fn("SpotifyAuth.writeTokenToCache")(
      function*(token: AccessToken) {
        const json = yield* AccessToken.toJson(token)
        yield* fs.writeFileString(cachedTokenPath, json)
      }
    )

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(baseUrl.toString()),
          HttpClientRequest.basicAuth(clientId, clientSecret),
          HttpClientRequest.acceptJson
        )
      ),
      HttpClient.filterStatusOk
    )

    const fetchToken = Effect.fn("SpotifyAuth.fetchToken")(
      function*() {
        const token = yield* httpClient.post("/api/token", {
          body: HttpBody.urlParams(UrlParams.fromInput({
            grant_type: "authorization_code",
            code: Redacted.value(authCode),
            redirect_uri: redirectUri
          }))
        }).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(AccessTokenFromAuthorizationCode)))

        yield* writeTokenToCache(token)

        return token
      },
      Effect.orDie
    )

    const refreshToken = Effect.fn("SpotifyAuth.refreshToken")(
      function*(token: AccessToken) {
        yield* Effect.logDebug("Refreshing Spotify access token")
        const refreshedToken = yield* httpClient.post("/api/token", {
          body: HttpBody.urlParams(UrlParams.fromInput({
            grant_type: "refresh_token",
            refresh_token: Redacted.value(token.refreshToken)
          }))
        }).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(SpotifyRefreshToken)),
          // According to the Spotify API documentation:
          // > The refresh token contained in the response, can be used to
          // > request new tokens. Depending on the grant used to get the
          // > initial refresh token, a refresh token might not be included in
          // > each response. When a refresh token is not returned, continue
          // > using the existing token.
          Effect.flatMap((response) =>
            Clock.currentTimeMillis.pipe(Effect.map((createdAt) => {
              return new AccessToken({
                ...response,
                refreshToken: Predicate.isNotUndefined(response.refreshToken)
                  ? response.refreshToken
                  : token.refreshToken,
                createdAt
              }, { disableValidation: true })
            }))
          )
        )

        yield* writeTokenToCache(refreshedToken)

        return refreshedToken
      },
      Effect.orDie
    )

    const refreshTokenIfExpired = Effect.fn("SpotifyAuth.refreshTokenIfExpired")(
      function*(token: AccessToken) {
        const now = yield* Clock.currentTimeMillis
        return yield* token.isExpired(now)
          ? refreshToken(token)
          : Effect.succeed(token)
      }
    )

    const initialToken = yield* readTokenFromCache().pipe(
      Effect.flatMap(refreshTokenIfExpired),
      Effect.orElse(() => fetchToken())
    )

    const tokenRef = yield* SynchronizedRef.make(initialToken)

    const getToken = Effect.fn("SpotifyAuth.getToken")(() =>
      SynchronizedRef.updateAndGetEffect(tokenRef, refreshTokenIfExpired)
    )

    // Periodically check if the token is expired and refresh it if necessary
    yield* getToken().pipe(
      Effect.interruptible,
      Effect.scheduleForked(Schedule.cron("0 0 * * *"))
    )

    return {
      getToken
    } as const
  })
}) {}
