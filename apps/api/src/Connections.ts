import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { OperatorIdentity } from "@twitch-integrations/domain/OperatorIdentity"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ConnectionObject, type ConnectionObjectShape } from "./ConnectionObject.ts"

export interface ConnectionsService {
  readonly describe: (provider: ProviderName) => Effect.Effect<ConnectionSummary>
  /** Starts an Authorization Attempt on the Provider's object and returns the consent URL. */
  readonly startAuthorization: (
    provider: ProviderName,
    operator: OperatorIdentity,
    callbackUri: string,
  ) => Effect.Effect<string>
}

/**
 * The service over any way of reaching a Provider's object: the namespace
 * stub in production, an in-process object in tests.
 */
const fromObjects = (
  objectFor: (provider: ProviderName) => ConnectionObjectShape,
): ConnectionsService => ({
  describe: (provider) => objectFor(provider).describe(),
  startAuthorization: (provider, operator, callbackUri) =>
    objectFor(provider).startAuthorization(operator, callbackUri),
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
