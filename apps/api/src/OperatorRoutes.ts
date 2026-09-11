import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { renderOperatorPage } from "./OperatorPage.ts"
import { OperatorResult } from "./OperatorResult.ts"

/**
 * Path prefixes the Cloudflare Access application covers. Every request under
 * them must carry an Access context. The match is a plain string prefix on
 * purpose: it fails closed, so a path like `/setupx` is refused rather than
 * admitted, and no route is registered on such a path anyway.
 */
const operatorPathPrefixes = ["/setup", "/oauth"]

const isOperatorPath = (url: string): boolean => {
  const path = url.split("?", 1)[0] ?? ""
  return operatorPathPrefixes.some((prefix) => path.startsWith(prefix))
}

const decodeResult = Schema.decodeUnknownOption(OperatorResult)

const operatorPage = Effect.gen(function* () {
  const searchParams = yield* HttpServerRequest.ParsedSearchParams
  const result = Option.getOrUndefined(decodeResult(searchParams.result))
  const sections = ProviderName.literals.map((provider) => ({
    provider,
    status: "Not Configured" as const,
  }))
  return HttpServerResponse.html(renderOperatorPage({ sections, result }))
})

const routes = HttpRouter.add("GET", "/setup", operatorPage)

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
      if (isOperatorPath(request.url)) {
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
