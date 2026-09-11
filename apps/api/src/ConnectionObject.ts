import * as DoSqlite from "@effect/sql-sqlite-do/SqliteClient"
import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { OperatorIdentity } from "@twitch-integrations/domain/OperatorIdentity"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import type * as SqlClient from "effect/unstable/sql/SqlClient"
import { AuthorizationFlow } from "./AuthorizationFlow.ts"
import { ConnectionStore } from "./ConnectionStore.ts"
import { Provider } from "./Provider.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"

/**
 * The RPC surface one Provider's Connection object exposes to the Worker. A
 * type alias rather than an interface so it satisfies Alchemy's RPC index
 * signature. Every member is a method: Alchemy's stub turns each property
 * access into a call, so a bare Effect member would not survive the RPC.
 */
export type ConnectionObjectShape = {
  /** What the Operator Page shows for this Provider. */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly describe: () => Effect.Effect<ConnectionSummary>
  /** Records an Authorization Attempt for the Operator and returns the consent URL. */
  readonly startAuthorization: (
    operator: OperatorIdentity,
    callbackUri: string,
  ) => Effect.Effect<string>
}

/**
 * The object's behavior over its services, independent of Durable Object
 * hosting: production wraps it in the class below, tests build it directly
 * over an in-memory store and fake Credentials.
 */
export const makeConnectionObject = (
  provider: ProviderName,
): Effect.Effect<ConnectionObjectShape, never, ConnectionStore | AuthorizationFlow> =>
  Effect.gen(function* () {
    const store = yield* ConnectionStore
    const flow = yield* AuthorizationFlow
    return {
      describe: () =>
        Effect.map(
          store.readConnection,
          Option.match({
            onNone: () => ({ provider, status: "Not Configured" as const }),
            onSome: (connection) => ({ provider, status: connection.status }),
          }),
        ),
      startAuthorization: flow.start,
    }
  })

/**
 * The object's whole layer graph over a `SqlClient` and the Provider
 * Credentials: the store, the Provider chosen by name, and the flow.
 */
export const connectionObjectLayer = (
  provider: ProviderName,
): Layer.Layer<
  ConnectionStore | AuthorizationFlow,
  never,
  SqlClient.SqlClient | ProviderCredentials
> =>
  Layer.provideMerge(
    AuthorizationFlow.layer,
    Layer.merge(ConnectionStore.layer, Provider.layer(provider)),
  )

const decodeProviderName = Schema.decodeUnknownEffect(ProviderName)

/**
 * One Durable Object instance per Provider, addressed by Provider name. The
 * object hosts the store over its own SQLite storage, so each Provider's
 * Connection and Attempts live in their own database.
 */
export class ConnectionObject extends Cloudflare.DurableObject<ConnectionObject>()(
  "ConnectionObject",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState
    // Alchemy's constructor contract: the init Effect returns the Effect that
    // builds the instance, so the nested Effect here is intended.
    // oxlint-disable-next-line effecttsgo/return-effect-in-gen
    return Effect.gen(function* () {
      // The object is only ever reached through `getByName(provider)`, so any
      // other name is a programming error rather than a request to refuse.
      const provider = yield* decodeProviderName(state.id.name).pipe(Effect.orDie)
      // The store lives as long as this in-memory instance. Its scope is
      // never closed on purpose: the adapter holds no finalizers, and workerd
      // evicts the whole isolate rather than signalling the instance.
      const instanceScope = yield* Scope.make()
      const services = yield* Layer.buildWithScope(
        connectionObjectLayer(provider).pipe(
          Layer.provide(DoSqlite.layer({ db: state.storage.sql.raw })),
          Layer.provide(ProviderCredentials.layer),
        ),
        instanceScope,
      )
      return yield* makeConnectionObject(provider).pipe(Effect.provide(services))
    })
  }),
) {}
