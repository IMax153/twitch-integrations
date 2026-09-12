import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import {
  DEV_ACCESS_ENV_KEY,
  WorkerExecutionContext,
  fromExecutionContext,
  makeRequestEffect,
  type WorkerAccessIdentity,
} from "alchemy/Cloudflare/Workers"
import { RuntimeContext } from "alchemy/RuntimeContext"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Record from "effect/Record"
import * as Redacted from "effect/Redacted"
import type * as Scope from "effect/Scope"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { Channel } from "../src/Channel.ts"
import {
  type ChannelObjectShape,
  channelObjectLayer,
  makeChannelObject,
} from "../src/ChannelObject.ts"
import { ChannelStore, type ChannelStoreService } from "../src/ChannelStore.ts"
import {
  type ConnectionObjectShape,
  connectionObjectLayer,
  makeConnectionObject,
} from "../src/ConnectionObject.ts"
import { Connections } from "../src/Connections.ts"
import { ConnectionStore, type ConnectionStoreService } from "../src/ConnectionStore.ts"
import { EventSubTransport } from "../src/EventSubTransport.ts"
import { RedemptionQueue } from "../src/RedemptionQueue.ts"
import type { RefreshAlarm } from "../src/RefreshAlarm.ts"
import { BroadcasterHttp } from "../src/BroadcasterRoutes.ts"
import { FakeProviders, type FakeProvidersService } from "./FakeProviders.ts"
import { FakeRefreshAlarm, type FakeRefreshAlarmService } from "./FakeRefreshAlarm.ts"
import { broadcaster } from "./fixtures.ts"

type ExecutionContext = Parameters<typeof fromExecutionContext>[0]
type BroadcasterHandler = Effect.Success<typeof BroadcasterHttp>

/**
 * Alchemy's request bridge is typed loosely; this pins the shape it has for
 * the Worker's handler so the harness stays fully typed.
 */
const sendThroughBridge = makeRequestEffect as unknown as (
  request: Request,
  handler: BroadcasterHandler,
) => Effect.Effect<
  Response,
  never,
  Exclude<Effect.Services<BroadcasterHandler>, HttpServerRequest.HttpServerRequest>
>

/** The Broadcaster's identity in the shape Cloudflare Access reports it. */
export const broadcasterIdentity: WorkerAccessIdentity = {
  email: broadcaster.email,
  user_uuid: broadcaster.userUuid,
}

const fakeExecutionContext = (): ExecutionContext =>
  ({
    waitUntil: () => {},
    passThroughOnException: () => {},
  }) as unknown as ExecutionContext

export interface SendOptions {
  readonly identity?: WorkerAccessIdentity
}

/** The receiver the Channel points Event Subscriptions at in tests, and the secret it signs with. */
export const testTransport = {
  callback: "https://stream.example/eventsub/twitch",
  secret: "test-webhook-secret-0123",
}

export interface WorldOptions {
  /** Whether the Channel may touch Event Subscriptions; false plays `alchemy dev`. */
  readonly eventSubscriptions?: boolean
}

/**
 * One Worker plus one in-process Connection object per Provider, each over
 * its own in-memory database, alive for the surrounding scope. The stores are
 * exposed so a test can arrange a Connection that no HTTP route creates yet,
 * the objects so a test can call an RPC no route reaches, and the alarms so
 * a test can see when each object's next refresh is armed for.
 */
export interface BroadcasterWorld {
  readonly send: (request: Request, options?: SendOptions) => Effect.Effect<Response>
  readonly stores: Record<ProviderName, ConnectionStoreService>
  readonly objects: Record<ProviderName, ConnectionObjectShape>
  /** The fake Providers every object talks to, shared so a test can script them. */
  readonly providers: FakeProvidersService
  /** Each object's fake alarm, one per Provider as each object has its own. */
  readonly alarms: Record<ProviderName, FakeRefreshAlarmService>
  /**
   * A new object over the Provider's existing storage and alarm, as workerd
   * builds one after evicting the previous instance.
   */
  readonly rebuildObject: (provider: ProviderName) => Effect.Effect<ConnectionObjectShape>
  /** The one in-process Channel object, over its own in-memory database and the Connection objects above. */
  readonly channel: ChannelObjectShape
  readonly channelStore: ChannelStoreService
  /** A new Channel object over the existing storage, as workerd builds one after an eviction. */
  readonly rebuildChannel: Effect.Effect<ChannelObjectShape>
  /** Returns once the Channel has processed every Redemption it has queued so far. */
  readonly settled: Effect.Effect<void>
}

/**
 * One object's services over a fresh in-memory database, playing one Durable
 * Object's storage, the fake Credentials, the `HttpClient` routed to the fake
 * Providers, and the object's own fake alarm.
 */
const inMemoryObject = (
  provider: ProviderName,
  httpClient: Layer.Layer<HttpClient.HttpClient>,
  alarm: Layer.Layer<RefreshAlarm>,
) =>
  Layer.build(
    connectionObjectLayer(provider).pipe(
      Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
      Layer.provide(FakeProviders.layerCredentials),
      Layer.provide(NodeCrypto.layer),
      Layer.provide(httpClient),
      Layer.provide(alarm),
    ),
  )

/** Runs `make` once per Provider and keys the results by Provider name. */
const perProvider = <A, E, R>(make: (provider: ProviderName) => Effect.Effect<A, E, R>) =>
  Effect.forEach(ProviderName.literals, (provider) =>
    Effect.map(make(provider), (value) => [provider, value] as const),
  ).pipe(Effect.map(Record.fromEntries))

export const makeWorld = Effect.fnUntraced(function* (options: WorldOptions = {}) {
  const fakes = yield* Layer.build(FakeProviders.layer)
  const providers = Context.get(fakes, FakeProviders)
  const alarms = yield* perProvider(() => Layer.build(FakeRefreshAlarm.layer))
  const services = yield* perProvider((provider) =>
    inMemoryObject(provider, Layer.succeedContext(fakes), Layer.succeedContext(alarms[provider])),
  )
  const stores = Record.map(services, Context.get(ConnectionStore))
  const rebuildObject = (provider: ProviderName) =>
    makeConnectionObject(provider).pipe(Effect.provide(services[provider]))
  const objects = yield* perProvider(rebuildObject)
  const connections = Layer.succeed(
    Connections,
    Connections.fromObjects((provider) => objects[provider]),
  )
  const channelServices = yield* Layer.build(
    channelObjectLayer.pipe(
      Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
      Layer.provide(FakeProviders.layerCredentials),
      Layer.provide(Layer.succeedContext(fakes)),
      Layer.provide(connections),
      Layer.provide(
        Layer.succeed(EventSubTransport, {
          callback: testTransport.callback,
          secret: Redacted.make(testTransport.secret),
          enabled: options.eventSubscriptions ?? true,
        }),
      ),
    ),
  )
  const rebuildChannel = makeChannelObject.pipe(Effect.provide(channelServices))
  const channel = yield* rebuildChannel
  const handler = yield* BroadcasterHttp.pipe(
    Effect.provide(
      Layer.merge(
        connections,
        Layer.succeed(
          Channel,
          Channel.fromObject(() => channel),
        ),
      ),
    ),
  )

  /**
   * Sends a Web request through Alchemy's request bridge to the Worker's
   * HTTP handler, with a fake execution context. Passing an identity
   * simulates a request admitted by Cloudflare Access; omitting it
   * simulates an unauthenticated request.
   */
  const send: BroadcasterWorld["send"] = (request, options) => {
    const env =
      options?.identity === undefined
        ? {}
        : { [DEV_ACCESS_ENV_KEY]: { aud: "test", identity: options.identity } }
    return sendThroughBridge(request, handler).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(WorkerExecutionContext, fromExecutionContext(fakeExecutionContext(), env)),
          RuntimeContext.phantom,
        ),
      ),
      Effect.scoped,
    )
  }

  return {
    send,
    stores,
    objects,
    providers,
    alarms: Record.map(alarms, Context.get(FakeRefreshAlarm)),
    rebuildObject,
    channel,
    channelStore: Context.get(channelServices, ChannelStore),
    rebuildChannel,
    settled: Context.get(channelServices, RedemptionQueue).settled,
  } satisfies BroadcasterWorld
})

/** A world in which the Channel manages Event Subscriptions, as in production. */
export const makeBroadcasterWorld: Effect.Effect<BroadcasterWorld, never, Scope.Scope> = makeWorld()
