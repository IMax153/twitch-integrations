import * as DoSqlite from "@effect/sql-sqlite-do/SqliteClient"
import { hasSettings, songRequestSettings } from "@twitch-integrations/domain/Reward"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Scope from "effect/Scope"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type * as SqlClient from "effect/unstable/sql/SqlClient"
import { ChannelReconcile, type ReconcileError } from "./ChannelReconcile.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { Connections } from "./Connections.ts"
import { EventSubTransport } from "./EventSubTransport.ts"
import { Helix } from "./Helix.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"
import { TwitchAppToken } from "./TwitchAppToken.ts"

/**
 * The RPC surface the Channel object exposes. A type alias rather than an
 * interface so it satisfies Alchemy's RPC index signature, and every member
 * a method, as on the Connection object.
 */
export type ChannelObjectShape = {
  /**
   * Brings the channel in line with the spec. Failures cross the boundary
   * as plain objects carrying their tag and fields.
   */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly reconcile: () => Effect.Effect<void, ReconcileError>
}

/**
 * The object's behavior over its services, independent of Durable Object
 * hosting. An object that starts with a stored Reward whose settings differ
 * from the spec's constants reconciles itself, so a change to the constants
 * reaches the channel without the Broadcaster reconnecting Twitch.
 */
export const makeChannelObject: Effect.Effect<
  ChannelObjectShape,
  never,
  ChannelStore | ChannelReconcile
> = Effect.gen(function* () {
  const store = yield* ChannelStore
  const { reconcile } = yield* ChannelReconcile
  const stored = yield* store.readReward
  if (Option.isSome(stored) && !hasSettings(stored.value, songRequestSettings)) {
    yield* Effect.logInfo("The stored Reward's settings differ from the spec; reconciling")
    yield* reconcile.pipe(observed, Effect.ignore)
  }
  return {
    reconcile: () => observed(reconcile),
  }
})

/**
 * The object's whole layer graph over a `SqlClient`, the Provider
 * Credentials, an `HttpClient`, the Worker's view of the Connection objects,
 * and the transport settings.
 */
export const channelObjectLayer: Layer.Layer<
  ChannelStore | ChannelReconcile,
  never,
  | SqlClient.SqlClient
  | ProviderCredentials
  | HttpClient.HttpClient
  | Connections
  | EventSubTransport
> = ChannelReconcile.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(ChannelStore.layer, Helix.layer, TwitchAppToken.layer)),
)

/**
 * The one Channel object, addressed by a fixed name. It hosts the Channel
 * store over its own SQLite storage and reaches the Connection objects over
 * their namespace, the same way the Worker does.
 */
export class ChannelObject extends Cloudflare.DurableObject<ChannelObject>()(
  "ChannelObject",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState
    // The Connection objects' namespace is resolved here, in the init
    // Effect, which is the only place the hosting Worker's services are
    // available; the instance Effect below may need only the object's own.
    // The object's init is its entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    const connections = yield* Effect.provide(Connections, Connections.layer)
    // Alchemy's constructor contract: the init Effect returns the Effect that
    // builds the instance, so the nested Effect here is intended.
    // oxlint-disable-next-line effecttsgo/return-effect-in-gen
    return observed(
      Effect.gen(function* () {
        // The store lives as long as this in-memory instance; its scope is
        // never closed on purpose, as on the Connection object.
        const instanceScope = yield* Scope.make()
        const services = yield* Layer.buildWithScope(
          channelObjectLayer.pipe(
            Layer.provide(DoSqlite.layer({ db: state.storage.sql.raw })),
            Layer.provide(ProviderCredentials.layer),
            Layer.provide(FetchHttpClient.layer),
            Layer.provide(Layer.succeed(Connections, connections)),
            Layer.provide(EventSubTransport.layer),
          ),
          instanceScope,
        )
        return yield* makeChannelObject.pipe(Effect.provide(services))
      }),
    )
  }),
) {}
