import {
  FileSystem,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Path,
  UrlParams
} from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Clock, Config, Effect, Match, Redacted, Schedule, Schema, Struct, SynchronizedRef } from "effect"
import type { ParseError } from "effect/ParseResult"

export const DEFAULT_SCOPES = [
  "channel:manage:redemptions",
  "user:write:chat"
] as const

export const TokenType = Schema.Literal("app", "user")
export type TokenType = typeof TokenType.Type

export class TwitchAppAccessToken extends Schema.Class<TwitchAppAccessToken>(
  "app/Twitch/Auth/TwitchAppAccessToken"
)({
  tokenType: Schema.Literal("bearer").pipe(
    Schema.propertySignature,
    Schema.fromKey("token_type")
  ),
  accessToken: Schema.Redacted(Schema.String).pipe(
    Schema.propertySignature,
    Schema.fromKey("access_token")
  ),
  expiresIn: Schema.Int.pipe(
    Schema.propertySignature,
    Schema.fromKey("expires_in")
  )
}) {}

export class AppAccessToken extends Schema.Class<AppAccessToken>(
  "app/Twitch/Auth/AppAccessToken"
)({
  ...TwitchAppAccessToken.fields,
  type: Schema.tag("app"),
  createdAt: Schema.Int
}) {
  static fromJson = Schema.decode(Schema.parseJson(this))
  static toJson = Schema.encode(Schema.parseJson(this))

  isExpired(now: number): boolean {
    return this.createdAt + (this.expiresIn * 1000) <= now
  }
}

export const AppAccessTokenFromTwitch = Schema.transformOrFail(
  TwitchAppAccessToken,
  Schema.typeSchema(AppAccessToken),
  {
    strict: true,
    decode: (encoded) =>
      Effect.map(Clock.currentTimeMillis, (createdAt) =>
        new AppAccessToken({
          ...encoded,
          createdAt
        }, { disableValidation: true })),
    encode: (decoded) => Effect.succeed(Struct.omit("createdAt", "app")(decoded))
  }
)

export class TwitchUserAccessToken extends Schema.Class<TwitchUserAccessToken>(
  "app/Twitch/Auth/TwitchUserAccessToken"
)({
  tokenType: Schema.Literal("bearer").pipe(
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
  scope: Schema.Array(Schema.NonEmptyString)
}) {}

export class UserAccessToken extends Schema.Class<UserAccessToken>(
  "app/Twitch/Auth/UserAccessToken"
)({
  ...TwitchUserAccessToken.fields,
  type: Schema.tag("user"),
  createdAt: Schema.Int
}) {
  static fromJson = Schema.decode(Schema.parseJson(this))
  static toJson = Schema.encode(Schema.parseJson(this))

  isExpired(now: number): boolean {
    return this.createdAt + (this.expiresIn * 1000) <= now
  }
}

export const UserAccessTokenFromTwitch = Schema.transformOrFail(
  TwitchUserAccessToken,
  Schema.typeSchema(UserAccessToken),
  {
    strict: true,
    decode: (encoded) =>
      Effect.map(Clock.currentTimeMillis, (createdAt) =>
        new UserAccessToken({
          ...encoded,
          createdAt
        }, { disableValidation: true })),
    encode: (decoded) => Effect.succeed(Struct.omit("createdAt", "user")(decoded))
  }
)

export const AccessToken: Schema.Union<[
  typeof AppAccessToken,
  typeof UserAccessToken
]> = Schema.Union(
  AppAccessToken,
  UserAccessToken
)
export type AccessToken = typeof AccessToken.Type

export class TwitchAuth extends Effect.Service<TwitchAuth>()("app/Twitch/Auth", {
  scoped: Effect.gen(function*() {
    const baseUrl = yield* Config.url("TWITCH_IDENTITY_BASE_URL")
    const redirectUri = yield* Config.string("TWITCH_OAUTH2_REDIRECT_URI")
    const clientId = yield* Config.string("TWITCH_CLIENT_ID")
    const clientSecret = yield* Config.redacted("TWITCH_CLIENT_SECRET")
    const authCode = yield* Config.redacted("TWITCH_AUTHORIZATION_CODE")
    const userId = yield* Config.string("TWITCH_USER_ID")

    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const cachedTokensDir = "/persist/twitch/tokens"
    const cachedAppTokenPath = path.join(cachedTokensDir, "app.json")
    const cachedUserTokenPath = path.join(cachedTokensDir, `${userId}.json`)

    yield* fs.makeDirectory(cachedTokensDir, { recursive: true }).pipe(
      Effect.whenEffect(Effect.map(fs.exists(cachedTokensDir), (exists) => !exists)),
      Effect.orDie
    )

    const tokenToJson = Match.type<AccessToken>().pipe(
      Match.when({ type: "app" }, (token) => AppAccessToken.toJson(token)),
      Match.when({ type: "user" }, (token) => UserAccessToken.toJson(token)),
      Match.exhaustive
    )

    const getCachedTokenPath = Match.type<TokenType>().pipe(
      Match.when("app", () => cachedAppTokenPath),
      Match.when("user", () => cachedUserTokenPath),
      Match.exhaustive
    )

    const readTokenFromCache: <Type extends TokenType>(
      type: Type
    ) => Effect.Effect<
      Extract<AccessToken, { type: Type }>,
      ParseError | PlatformError,
      never
    > = Effect.fn("TwitchAuth.readTokenFromCache")(
      function*(type) {
        const json = yield* fs.readFileString(getCachedTokenPath(type), "utf-8")
        switch (type) {
          case "app":
            return yield* AppAccessToken.fromJson(json)
          case "user":
            return yield* UserAccessToken.fromJson(json)
        }
      }
    ) as any

    const writeTokenToCache = Effect.fn("TwitchAuth.writeTokenToCache")(
      function*(token: AccessToken) {
        const path = getCachedTokenPath(token.type)
        const json = yield* tokenToJson(token)
        yield* fs.writeFileString(path, json)
      }
    )

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(baseUrl.toString()),
          HttpClientRequest.acceptJson
        )
      ),
      HttpClient.filterStatusOk
    )

    const fetchAppToken = Effect.fn("TwitchAuth.fetchAppToken")(
      function*() {
        yield* Effect.logDebug("Fetching Twitch app access token")

        const token = yield* httpClient.post("/oauth2/token", {
          body: HttpBody.urlParams(UrlParams.fromInput({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: Redacted.value(clientSecret)
          }))
        }).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(AppAccessTokenFromTwitch)))

        yield* writeTokenToCache(token)

        return token
      },
      Effect.orDie
    )

    const fetchUserToken = Effect.fn("TwitchAuth.fetchUserToken")(
      function*() {
        yield* Effect.logDebug("Fetching Twitch user access token")

        const token = yield* httpClient.post("/oauth2/token", {
          body: HttpBody.urlParams(UrlParams.fromInput({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: Redacted.value(clientSecret),
            code: Redacted.value(authCode),
            redirect_uri: redirectUri
          }))
        }).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(UserAccessTokenFromTwitch)))

        yield* writeTokenToCache(token)

        return token
      },
      Effect.orDie
    )

    const refreshUserToken = Effect.fn("TwitchAuth.refreshUserToken")(
      function*(token: UserAccessToken) {
        yield* Effect.logDebug("Refreshing Twitch user access token")

        const refreshedToken = yield* httpClient.post("/oauth2/token", {
          body: HttpBody.urlParams(UrlParams.fromInput({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: Redacted.value(clientSecret),
            refresh_token: Redacted.value(token.refreshToken)
          }))
        }).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(UserAccessTokenFromTwitch)))

        yield* writeTokenToCache(refreshedToken)

        return refreshedToken
      },
      Effect.orDie
    )

    const refreshTokenIfExpired: <Token extends AccessToken>(type: Token) => Effect.Effect<
      Extract<Token, { type: Token["type"] }>
    > = Effect.fn("TwitchAuth.refreshTokenIfExpired")(
      function*(token) {
        switch (token.type) {
          case "app": {
            const now = yield* Clock.currentTimeMillis
            return yield* token.isExpired(now)
              ? fetchAppToken()
              : Effect.succeed(token)
          }
          case "user": {
            const now = yield* Clock.currentTimeMillis
            return yield* token.isExpired(now)
              ? refreshUserToken(token)
              : Effect.succeed(token)
          }
        }
      }
    ) as any

    const initialAppToken = yield* readTokenFromCache("app").pipe(
      Effect.flatMap(refreshTokenIfExpired),
      Effect.orElse(() => fetchAppToken())
    )
    const initialUserToken = yield* readTokenFromCache("user").pipe(
      Effect.flatMap(refreshTokenIfExpired),
      Effect.orElse(() => fetchUserToken())
    )

    const appTokenRef = yield* SynchronizedRef.make(initialAppToken)
    const userTokenRef = yield* SynchronizedRef.make(initialUserToken)

    const getToken: <Type extends TokenType>(type: TokenType) => Effect.Effect<
      Extract<AccessToken, { type: Type }>
    > = Effect.fn("TwitchAuth.getToken")((type: TokenType) => {
      switch (type) {
        case "app":
          return SynchronizedRef.updateAndGetEffect(
            appTokenRef,
            refreshTokenIfExpired
          )
        case "user":
          return SynchronizedRef.updateAndGetEffect(
            userTokenRef,
            refreshTokenIfExpired
          )
      }
    }) as any

    // Periodically check if the token is expired and refresh it if necessary
    yield* getToken("app").pipe(
      Effect.interruptible,
      Effect.scheduleForked(Schedule.cron("0 0 * * *"))
    )
    yield* getToken("user").pipe(
      Effect.interruptible,
      Effect.scheduleForked(Schedule.cron("0 0 * * *"))
    )

    return {
      getToken
    } as const
  })
}) {}
