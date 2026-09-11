import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import * as Context from "effect/Context"
import * as Crypto from "effect/Crypto"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { ConnectionStore } from "./ConnectionStore.ts"
import { Provider } from "./Provider.ts"

export interface AuthorizationFlowService {
  /**
   * Records an Authorization Attempt for the Broadcaster and returns the
   * Provider consent URL the browser must be sent to. The callback URI is
   * stored with the Attempt so the callback can only complete it from the
   * same origin.
   */
  readonly start: (broadcaster: BroadcasterIdentity, callbackUri: string) => Effect.Effect<string>
}

/** How long the Broadcaster has to finish consent before the Attempt is stale. */
const attemptLifetime = { minutes: 10 }

const make = Effect.gen(function* () {
  const store = yield* ConnectionStore
  const provider = yield* Provider
  const crypto = yield* Crypto.Crypto

  // NOTE: the state value guards the callback against forgery, so it comes
  // from the platform's cryptographic source rather than the seeded
  // pseudo-random `Random` service. The platform cannot fail to produce
  // sixteen random bytes, so a failure is a defect.
  const randomState = Effect.orDie(crypto.randomUUIDv4)

  const consentUrl = (attempt: AuthorizationAttempt): string => {
    const url = new URL(provider.authorizeUrl)
    url.searchParams.set("client_id", Redacted.value(provider.credentials.clientId))
    url.searchParams.set("response_type", "code")
    url.searchParams.set("redirect_uri", attempt.callbackUri)
    url.searchParams.set("scope", provider.scopes.join(" "))
    url.searchParams.set("state", attempt.state)
    return url.toString()
  }

  return AuthorizationFlow.of({
    start: (broadcaster, callbackUri) =>
      Effect.gen(function* () {
        const createdAt = yield* DateTime.now
        const attempt: AuthorizationAttempt = {
          state: yield* randomState,
          provider: provider.name,
          callbackUri,
          broadcaster,
          createdAt,
          expiresAt: DateTime.add(createdAt, attemptLifetime),
          consumed: false,
        }
        yield* store.createAttempt(attempt)
        return consentUrl(attempt)
      }),
  })
})

/** Starts Provider authorizations for one Provider's Connection. */
export class AuthorizationFlow extends Context.Service<
  AuthorizationFlow,
  AuthorizationFlowService
>()("@twitch-integrations/api/AuthorizationFlow") {
  static readonly layer: Layer.Layer<
    AuthorizationFlow,
    never,
    ConnectionStore | Provider | Crypto.Crypto
  > = Layer.effect(AuthorizationFlow)(make)
}
