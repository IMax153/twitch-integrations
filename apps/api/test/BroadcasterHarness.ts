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
import type * as Scope from "effect/Scope"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import {
  type ConnectionObjectShape,
  connectionObjectLayer,
  makeConnectionObject,
} from "../src/ConnectionObject.ts"
import { Connections } from "../src/Connections.ts"
import { ConnectionStore, type ConnectionStoreService } from "../src/ConnectionStore.ts"
import { BroadcasterHttp } from "../src/BroadcasterRoutes.ts"
import { FakeProviders, type FakeProvidersService } from "./FakeProviders.ts"
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

/**
 * One Worker plus one in-process Connection object per Provider, each over
 * its own in-memory database, alive for the surrounding scope. The stores are
 * exposed so a test can arrange a Connection that no HTTP route creates yet,
 * and the objects so a test can call an RPC no route reaches.
 */
export interface BroadcasterWorld {
  readonly send: (request: Request, options?: SendOptions) => Effect.Effect<Response>
  readonly stores: Record<ProviderName, ConnectionStoreService>
  readonly objects: Record<ProviderName, ConnectionObjectShape>
  /** The fake Providers every object talks to, shared so a test can script them. */
  readonly providers: FakeProvidersService
}

/**
 * One object's services over a fresh in-memory database, playing one Durable
 * Object's storage, the fake Credentials, and the `HttpClient` routed to the
 * fake Providers.
 */
const inMemoryObject = (provider: ProviderName, httpClient: Layer.Layer<HttpClient.HttpClient>) =>
  Layer.build(
    connectionObjectLayer(provider).pipe(
      Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
      Layer.provide(FakeProviders.credentials),
      Layer.provide(NodeCrypto.layer),
      Layer.provide(httpClient),
    ),
  )

/** Runs `make` once per Provider and keys the results by Provider name. */
const perProvider = <A, E, R>(make: (provider: ProviderName) => Effect.Effect<A, E, R>) =>
  Effect.forEach(ProviderName.literals, (provider) =>
    Effect.map(make(provider), (value) => [provider, value] as const),
  ).pipe(Effect.map(Record.fromEntries))

export const makeBroadcasterWorld: Effect.Effect<BroadcasterWorld, never, Scope.Scope> = Effect.gen(
  function* () {
    const fakes = yield* Layer.build(FakeProviders.layer)
    const providers = Context.get(fakes, FakeProviders)
    const services = yield* perProvider((provider) =>
      inMemoryObject(provider, Layer.succeedContext(fakes)),
    )
    const stores = Record.map(services, Context.get(ConnectionStore))
    const objects = yield* perProvider((provider) =>
      makeConnectionObject(provider).pipe(Effect.provide(services[provider])),
    )
    const connections = Layer.succeed(
      Connections,
      Connections.fromObjects((provider) => objects[provider]),
    )
    const handler = yield* BroadcasterHttp.pipe(Effect.provide(connections))

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
            Layer.succeed(
              WorkerExecutionContext,
              fromExecutionContext(fakeExecutionContext(), env),
            ),
            RuntimeContext.phantom,
          ),
        ),
        Effect.scoped,
      )
    }

    return { send, stores, objects, providers }
  },
)
