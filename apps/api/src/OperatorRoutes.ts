import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"

/**
 * Path prefixes that must carry an Access context. Cloudflare Access gates
 * the whole Worker at the edge; this check is the fail-closed backstop, so a
 * misconfigured application refuses rather than admits. The match is a plain
 * string prefix on purpose, so a path like `/setupx` is refused too.
 */
const operatorPathPrefixes = ["/setup", "/oauth"]

const pathOf = (url: string): string => url.split("?", 1)[0] ?? ""

const isOperatorPath = (path: string): boolean =>
  operatorPathPrefixes.some((prefix) => path.startsWith(prefix))

const connectionSummaries = HttpServerResponse.schemaJson(Schema.Array(ConnectionSummary))

const connectionsResponse = connectionSummaries(
  ProviderName.literals.map((provider) => ({ provider, status: "Not Configured" as const })),
)

const routes = HttpRouter.add("GET", "/setup/api/connections", connectionsResponse)

const accessRequired = HttpServerResponse.text("Access required", { status: 403 })

/**
 * The Worker's HTTP handler: the Access gate over the operator path prefixes,
 * then the router.
 *
 * The router layer is built once and its scope closed immediately. That is
 * fine while the router holds no scoped resources; a scoped middleware or
 * service added to `routes` would need this scope to outlive the handler.
 */
export const OperatorHttp = HttpRouter.toHttpEffect(routes).pipe(
  Effect.map((router) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (isOperatorPath(pathOf(request.url))) {
        const access = yield* Cloudflare.Access.Context
        if (access === undefined) {
          return accessRequired
        }
      }
      return yield* router
    }),
  ),
  Effect.scoped,
)
