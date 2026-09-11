import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { OperatorIdentity } from "@twitch-integrations/domain/OperatorIdentity"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ConnectionObject } from "./ConnectionObject.ts"

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
 * The Worker's view of every Provider's Connection object. In production it
 * wraps the Durable Object namespace RPC; tests provide the objects
 * in-process over the same code.
 */
export class Connections extends Context.Service<Connections, ConnectionsService>()(
  "@twitch-integrations/api/Connections",
) {
  /** Built in the Worker init, where yielding the class registers the binding. */
  static readonly layer = Layer.effect(Connections)(
    Effect.map(ConnectionObject, (objects) => ({
      describe: (provider) => objects.getByName(provider).describe(),
      startAuthorization: (provider, operator, callbackUri) =>
        objects.getByName(provider).startAuthorization(operator, callbackUri),
    })),
  )
}
