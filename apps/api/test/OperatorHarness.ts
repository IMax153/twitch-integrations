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
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { connectionObjectLayer, makeConnectionObject } from "../src/ConnectionObject.ts"
import { Connections } from "../src/Connections.ts"
import { ConnectionStore, type ConnectionStoreService } from "../src/ConnectionStore.ts"
import { ProviderCredentials } from "../src/ProviderCredentials.ts"
import { OperatorHttp } from "../src/OperatorRoutes.ts"
import { operator } from "./fixtures.ts"

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

/** The Operator's identity in the shape Cloudflare Access reports it. */
export const operatorIdentity: WorkerAccessIdentity = {
  email: operator.email,
  user_uuid: operator.userUuid,
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

/** Fake Credentials with recognisable values, so a test can spot them in a consent URL. */
const fakeCredentials = Layer.succeed(ProviderCredentials, {
  spotify: {
    clientId: Redacted.make("spotify-client-id"),
    clientSecret: Redacted.make("spotify-client-secret"),
  },
  twitch: {
    clientId: Redacted.make("twitch-client-id"),
    clientSecret: Redacted.make("twitch-client-secret"),
  },
})

/**
 * One object's services over a fresh in-memory database, playing one Durable
 * Object's storage, and the fake Credentials.
 */
const inMemoryObject = (provider: ProviderName) =>
  Layer.build(
    connectionObjectLayer(provider).pipe(
      Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
      Layer.provide(fakeCredentials),
      Layer.provide(NodeCrypto.layer),
    ),
  )

/** Runs `make` once per Provider and keys the results by Provider name. */
const perProvider = <A, E, R>(make: (provider: ProviderName) => Effect.Effect<A, E, R>) =>
  Effect.forEach(ProviderName.literals, (provider) =>
    Effect.map(make(provider), (value) => [provider, value] as const),
  ).pipe(Effect.map(Record.fromEntries))

export const makeOperatorWorld: Effect.Effect<OperatorWorld, never, Scope.Scope> = Effect.gen(
  function* () {
    const services = yield* perProvider(inMemoryObject)
    const stores = Record.map(services, Context.get(ConnectionStore))
    const objects = yield* perProvider((provider) =>
      makeConnectionObject(provider).pipe(Effect.provide(services[provider])),
    )
    const connections = Layer.succeed(
      Connections,
      Connections.fromObjects((provider) => objects[provider]),
    )
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
