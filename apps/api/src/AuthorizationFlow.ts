import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import type { Connection } from "@twitch-integrations/domain/Connection"
import * as Context from "effect/Context"
import * as Crypto from "effect/Crypto"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { ConnectionLifecycle } from "./ConnectionLifecycle.ts"
import {
  type AttemptClaim,
  type AuthorizationAttemptRejected,
  ConnectionStore,
} from "./ConnectionStore.ts"
import { Provider, type ProviderRequestFailed } from "./Provider.ts"

export interface AuthorizationFlowService {
  /**
   * Records an Authorization Attempt for the Broadcaster and returns the
   * Provider consent URL the browser must be sent to. The callback URI is
   * stored with the Attempt so the callback can only complete it from the
   * same origin.
   */
  readonly start: (broadcaster: BroadcasterIdentity, callbackUri: string) => Effect.Effect<string>
  /**
   * Finishes the Attempt the claim names: consumes it, exchanges the code,
   * looks up the Connected Account, and installs the result as the
   * Connection. The Attempt is consumed even when the exchange then fails,
   * so a code is only ever presented to the Provider once.
   */
  readonly complete: (
    claim: AttemptClaim,
    code: string,
  ) => Effect.Effect<Connection, AuthorizationAttemptRejected | ProviderRequestFailed>
  /**
   * Ends the Attempt the claim names without a code, as when the Broadcaster
   * denied consent at the Provider. The Attempt is consumed so its state
   * value cannot be presented again; the Connection is left as it was.
   */
  readonly abandon: (claim: AttemptClaim) => Effect.Effect<void, AuthorizationAttemptRejected>
}

/** How long the Broadcaster has to finish consent before the Attempt is stale. */
const attemptLifetime = { minutes: 10 }

const make = Effect.gen(function* () {
  const store = yield* ConnectionStore
  const provider = yield* Provider
  const lifecycle = yield* ConnectionLifecycle
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
    complete: (claim, code) =>
      Effect.gen(function* () {
        yield* store.consumeAttempt(claim)
        const tokens = yield* provider.exchangeCode(code, claim.callbackUri)
        const connectedAccount = yield* provider.fetchConnectedAccount(tokens.accessToken)
        return yield* lifecycle.accept(tokens, connectedAccount)
      }),
    abandon: store.consumeAttempt,
  })
})

/** Starts and completes Provider authorizations for one Provider's Connection. */
export class AuthorizationFlow extends Context.Service<
  AuthorizationFlow,
  AuthorizationFlowService
>()("@twitch-integrations/api/AuthorizationFlow") {
  static readonly layer: Layer.Layer<
    AuthorizationFlow,
    never,
    ConnectionStore | Provider | ConnectionLifecycle | Crypto.Crypto
  > = Layer.effect(AuthorizationFlow)(make)
}
