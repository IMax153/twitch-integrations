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
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { makeConnectionObject } from "../src/ConnectionObject.ts"
import { Connections } from "../src/Connections.ts"
import { ConnectionStore, type ConnectionStoreService } from "../src/ConnectionStore.ts"
import { OperatorHttp } from "../src/OperatorRoutes.ts"

type ExecutionContext = Parameters<typeof fromExecutionContext>[0]
type OperatorHandler = Effect.Success<typeof OperatorHttp>

/**
 * Alchemy's request bridge is typed loosely; this pins the shape it has for
 * the Worker's handler so the harness stays fully typed.
 */
const sendThroughBridge = makeRequestEffect as unknown as (
  request: Request,
  handler: OperatorHandler,
) => Effect.Effect<
  Response,
  never,
  Exclude<Effect.Services<OperatorHandler>, HttpServerRequest.HttpServerRequest>
>

export const operatorIdentity: WorkerAccessIdentity = {
  email: "operator@example.com",
  user_uuid: "8d5c1a1e-4b7e-4d2b-9c1a-2f3e4d5c6b7a",
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
 * exposed so a test can arrange a Connection that no HTTP route creates yet.
 */
export interface OperatorWorld {
  readonly send: (request: Request, options?: SendOptions) => Effect.Effect<Response>
  readonly stores: Record<ProviderName, ConnectionStoreService>
}

/** The real store over a fresh in-memory database, playing one Durable Object's storage. */
const inMemoryStore = Layer.build(
  ConnectionStore.layer.pipe(Layer.provide(SqliteClient.layer({ filename: ":memory:" }))),
).pipe(Effect.map(Context.get(ConnectionStore)))

export const makeOperatorWorld: Effect.Effect<OperatorWorld, never, Scope.Scope> = Effect.gen(
  function* () {
    const stores = yield* Effect.forEach(ProviderName.literals, (provider) =>
      Effect.map(inMemoryStore, (store) => [provider, store] as const),
    ).pipe(Effect.map(Record.fromEntries))
    const objects = yield* Effect.forEach(ProviderName.literals, (provider) =>
      makeConnectionObject(provider).pipe(
        Effect.provideService(ConnectionStore, stores[provider]),
        Effect.map((object) => [provider, object] as const),
      ),
    ).pipe(Effect.map(Record.fromEntries))
    const connections = Layer.succeed(Connections, {
      describe: (provider) => objects[provider].describe(),
    })
    const handler = yield* OperatorHttp.pipe(Effect.provide(connections))

    /**
     * Sends a Web request through Alchemy's request bridge to the Worker's
     * HTTP handler, with a fake execution context. Passing an identity
     * simulates a request admitted by Cloudflare Access; omitting it
     * simulates an unauthenticated request.
     */
    const send: OperatorWorld["send"] = (request, options) => {
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

    return { send, stores }
  },
)
