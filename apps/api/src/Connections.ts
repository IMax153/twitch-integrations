import type { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import type { ConnectionSummaryEncoded } from "@twitch-integrations/domain/ConnectionSummary"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import type {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { ConnectionObject, type ConnectionObjectShape } from "./ConnectionObject.ts"
import type { AttemptClaim } from "./ConnectionStore.ts"
import type { ProviderRequestFailed } from "./Provider.ts"

export interface ConnectionsService {
  /** The Provider's summary as the object encoded it, ready to serve as JSON. */
  readonly describe: (provider: ProviderName) => Effect.Effect<ConnectionSummaryEncoded>
  /** Starts an Authorization Attempt on the Provider's object and returns the consent URL. */
  readonly startAuthorization: (
    provider: ProviderName,
    broadcaster: BroadcasterIdentity,
    callbackUri: string,
  ) => Effect.Effect<string>
  /** Completes an Authorization Attempt on the Provider's object and returns the outcome. */
  readonly completeAuthorization: (
    provider: ProviderName,
    claim: AttemptClaim,
    code: string,
  ) => Effect.Effect<BroadcasterResult>
  /** Ends an Authorization Attempt the Provider answered with an error, and returns the outcome. */
  readonly abandonAuthorization: (
    provider: ProviderName,
    claim: AttemptClaim,
  ) => Effect.Effect<BroadcasterResult>
  /**
   * A valid access token for the Provider's Connection, refreshed by the
   * object first when it is about to expire. In production a failure arrives
   * over the RPC as a plain object carrying the error's tag and fields, not
   * an instance, so callers match on `_tag` rather than `instanceof`.
   */
  readonly getAccessToken: (
    provider: ProviderName,
  ) => Effect.Effect<
    Redacted.Redacted<string>,
    ConnectionNotConfigured | ReauthorizationRequired | ProviderRequestFailed
  >
}

/**
 * The service over any way of reaching a Provider's object: the namespace
 * stub in production, an in-process object in tests.
 */
const fromObjects = (
  objectFor: (provider: ProviderName) => ConnectionObjectShape,
): ConnectionsService => ({
  describe: (provider) => objectFor(provider).describe(),
  startAuthorization: (provider, broadcaster, callbackUri) =>
    objectFor(provider).startAuthorization(broadcaster, callbackUri),
  completeAuthorization: (provider, claim, code) =>
    objectFor(provider).completeAuthorization(claim, code),
  abandonAuthorization: (provider, claim) => objectFor(provider).abandonAuthorization(claim),
  getAccessToken: (provider) => Effect.map(objectFor(provider).getAccessToken(), Redacted.make),
})

const make = Effect.map(ConnectionObject, (objects) =>
  fromObjects((provider) => objects.getByName(provider)),
)

/**
 * The Worker's view of every Provider's Connection object. In production it
 * wraps the Durable Object namespace RPC; tests provide the objects
 * in-process over the same code.
 */
export class Connections extends Context.Service<Connections, ConnectionsService>()(
  "@twitch-integrations/api/Connections",
) {
  /** Built in the Worker init, where yielding the class registers the binding. */
  static readonly layer = Layer.effect(Connections)(make)
  static readonly fromObjects = fromObjects
}
