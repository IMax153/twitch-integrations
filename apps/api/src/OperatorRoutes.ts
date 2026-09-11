import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { Assets } from "./Assets.ts"

/**
 * Path prefixes the Cloudflare Access application covers. Every request under
 * them must carry an Access context. The match is a plain string prefix on
 * purpose: it fails closed, so a path like `/setupx` is refused rather than
 * admitted, and no route is registered on such a path anyway.
 */
const operatorPathPrefixes = ["/setup", "/oauth"]

/** Where the Operator Page app lives, and the JSON routes it calls. */
const pagePrefix = "/setup"
const apiPrefix = "/setup/api"

const pathOf = (url: string): string => url.split("?", 1)[0] ?? ""

const isOperatorPath = (path: string): boolean =>
  operatorPathPrefixes.some((prefix) => path.startsWith(prefix))

const isUnder = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`)

const isPagePath = (path: string): boolean => isUnder(path, pagePrefix) && !isUnder(path, apiPrefix)

const connectionSummaries = HttpServerResponse.schemaJson(Schema.Array(ConnectionSummary))

const connectionsResponse = connectionSummaries(
  ProviderName.literals.map((provider) => ({ provider, status: "Not Configured" as const })),
)

const routes = HttpRouter.add("GET", "/setup/api/connections", connectionsResponse)

const accessRequired = HttpServerResponse.text("Access required", { status: 403 })

/**
 * Serves the Operator Page from the assets: the matching file when there is
 * one, otherwise the app shell so deep links boot the app.
 *
 * The build sits at the assets root while the page is served under
 * `/setup`, so the Worker strips the prefix itself rather than relying on
 * the asset layer's `base` option. That keeps the mapping identical under
 * `alchemy dev`, where the local asset server reads the directory as is.
 */
const servePage = Effect.fn("servePage")(function* (path: string, method: "GET" | "HEAD") {
  const assets = yield* Assets
  const assetPath = path.slice(pagePrefix.length) || "/"
  const file = yield* assets.fetch(assetPath === "/" ? "/index.html" : assetPath, method)
  const response = file.status === 404 ? yield* assets.fetch("/index.html", method) : file
  return HttpServerResponse.fromWeb(response)
})

/**
 * The Worker's HTTP handler: the Access gate over the operator path prefixes,
 * then the Operator Page assets, then the router.
 *
 * The router layer is built once and its scope closed immediately. That is
 * fine while the router holds no scoped resources; a scoped middleware or
 * service added to `routes` would need this scope to outlive the handler.
 */
export const OperatorHttp = HttpRouter.toHttpEffect(routes).pipe(
  Effect.map((router) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const path = pathOf(request.url)
      if (isOperatorPath(path)) {
        const access = yield* Cloudflare.Access.Context
        if (access === undefined) {
          return accessRequired
        }
      }
      if (isPagePath(path) && (request.method === "GET" || request.method === "HEAD")) {
        return yield* servePage(path, request.method)
      }
      return yield* router
    }),
  ),
  Effect.scoped,
)
