import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Ref from "effect/Ref"
import * as Semaphore from "effect/Semaphore"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import { Provider, type ProviderRequestFailed } from "./Provider.ts"
import type { ProviderCredentials } from "./ProviderCredentials.ts"

export interface TwitchAppTokenService {
  /**
   * A valid app access token: the cached one while more than the threshold
   * remains before its expiry, otherwise a fresh one from the client
   * credentials grant. Concurrent requests share one grant.
   */
  readonly get: Effect.Effect<Redacted.Redacted<string>, ProviderRequestFailed>
}

/** How close to expiry a cached token is no longer handed out. */
const threshold = Duration.minutes(1)

interface CachedToken {
  readonly token: Redacted.Redacted<string>
  readonly expiresAt: DateTime.Utc
}

const isFresh = (cached: CachedToken, now: DateTime.Utc): boolean =>
  DateTime.toEpochMillis(cached.expiresAt) - DateTime.toEpochMillis(now) >
  Duration.toMillis(threshold)

const make = Effect.gen(function* () {
  const provider = yield* Provider
  const cache = yield* Ref.make<Option.Option<CachedToken>>(Option.none())
  const lock = yield* Semaphore.make(1)

  const cached: Effect.Effect<Option.Option<Redacted.Redacted<string>>> = Effect.gen(function* () {
    const now = yield* DateTime.now
    return Option.flatMap(yield* Ref.get(cache), (entry) =>
      isFresh(entry, now) ? Option.some(entry.token) : Option.none(),
    )
  })

  const request: Effect.Effect<Redacted.Redacted<string>, ProviderRequestFailed> = Effect.gen(
    function* () {
      const response = yield* provider.requestClientCredentials
      const now = yield* DateTime.now
      yield* Ref.set(
        cache,
        Option.some({
          token: response.accessToken,
          expiresAt: DateTime.addDuration(now, response.expiresIn),
        }),
      )
      return response.accessToken
    },
  )

  // NOTE: checked again under the lock: a request that waited behind a
  // grant finds the new token and must not request another.
  const get = Effect.flatMap(cached, (token) =>
    Option.isSome(token)
      ? Effect.succeed(token.value)
      : lock.withPermit(
          Effect.flatMap(cached, (again) =>
            Option.isSome(again) ? Effect.succeed(again.value) : request,
          ),
        ),
  )

  return TwitchAppToken.of({ get })
})

/**
 * The Twitch app access token, obtained by client credentials with the
 * Twitch Credentials and cached in memory until it nears expiry. It is never
 * stored, and it is used only to manage Event Subscriptions.
 */
export class TwitchAppToken extends Context.Service<TwitchAppToken, TwitchAppTokenService>()(
  "@twitch-integrations/api/TwitchAppToken",
) {
  static readonly layer: Layer.Layer<
    TwitchAppToken,
    never,
    ProviderCredentials | HttpClient.HttpClient
  > = Layer.effect(TwitchAppToken)(make).pipe(Layer.provide(Provider.layer("twitch")))
}
