import {
  DEV_ACCESS_ENV_KEY,
  WorkerExecutionContext,
  fromExecutionContext,
  makeRequestEffect,
  type WorkerAccessIdentity,
} from "alchemy/Cloudflare/Workers"
import { RuntimeContext } from "alchemy/RuntimeContext"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { Assets } from "../src/Assets.ts"
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

/** The Operator Page build as the tests see it: a file per asset path. */
export const webAssets: Record<string, string> = {
  "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
  "/assets/app.js": "console.log('operator page')",
}

const contentTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
}

const fakeAssets = Layer.succeed(
  Assets,
  Assets.of({
    fetch: (path, method = "GET") =>
      Effect.sync(() => {
        const body = webAssets[path]
        if (body === undefined) {
          return new Response("Not found", { status: 404 })
        }
        const extension = path.split(".").at(-1) ?? ""
        return new Response(method === "HEAD" ? null : body, {
          headers: { "content-type": contentTypes[extension] ?? "application/octet-stream" },
        })
      }),
  }),
)

const fakeExecutionContext = (): ExecutionContext =>
  ({
    waitUntil: () => {},
    passThroughOnException: () => {},
  }) as unknown as ExecutionContext

/**
 * Sends a Web request through Alchemy's request bridge to the Worker's HTTP
 * handler, with a fake execution context and the fake assets. Passing an
 * identity simulates a request admitted by Cloudflare Access; omitting it
 * simulates an unauthenticated request.
 */
export const sendOperatorRequest = (
  request: Request,
  options?: { readonly identity?: WorkerAccessIdentity },
): Effect.Effect<Response> => {
  const env =
    options?.identity === undefined
      ? {}
      : { [DEV_ACCESS_ENV_KEY]: { aud: "test", identity: options.identity } }
  return Effect.gen(function* () {
    const handler = yield* OperatorHttp
    return yield* sendThroughBridge(request, handler)
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(WorkerExecutionContext, fromExecutionContext(fakeExecutionContext(), env)),
        RuntimeContext.phantom,
        fakeAssets,
      ),
    ),
    Effect.scoped,
  )
}
