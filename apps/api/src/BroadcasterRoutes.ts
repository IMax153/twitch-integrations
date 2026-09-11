import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { Connections } from "./Connections.ts"

/**
 * Path prefixes that must carry an Access context. Cloudflare Access gates
 * the whole Worker at the edge; this check is the fail-closed backstop, so a
 * misconfigured application refuses rather than admits. The match is a plain
 * string prefix on purpose, so a path like `/setupx` is refused too.
 */
const broadcasterPathPrefixes = ["/setup", "/oauth"]

const pathOf = (url: string): string => url.split("?", 1)[0] ?? ""

const isBroadcasterPath = (path: string): boolean =>
  broadcasterPathPrefixes.some((prefix) => path.startsWith(prefix))

const connectionSummaries = HttpServerResponse.schemaJson(Schema.Array(ConnectionSummary))

const connectionsResponse = Effect.gen(function* () {
  const connections = yield* Connections
  const summaries = yield* Effect.forEach(ProviderName.literals, connections.describe)
  return yield* connectionSummaries(summaries)
})

const accessRequired = HttpServerResponse.text("Access required", { status: 403 })

const unknownProvider = HttpServerResponse.text("Unknown Provider", { status: 404 })

const isProviderName = Schema.is(ProviderName)

/** The fixed path the Provider redirects back to, relative to the request's origin. */
const callbackPath = (provider: ProviderName) => `/oauth/${provider}/callback`

/**
 * The Broadcaster behind the request, or none when Access reports an identity
 * without the fields an Attempt is bound to. The gate below already refused
 * a request with no context at all; this covers an identity provider that
 * reports an incomplete one. A failure to resolve the identity is a platform
 * fault rather than a refusal, so it is left to surface as a defect.
 */
const readBroadcaster: Effect.Effect<
  Option.Option<BroadcasterIdentity>,
  never,
  Effect.Services<typeof Cloudflare.Access.Context>
> = Effect.gen(function* () {
  const access = yield* Cloudflare.Access.Context
  const identity = yield* access === undefined ? Effect.undefined : access.getIdentity()
  return identity?.user_uuid === undefined || identity.email === undefined
    ? Option.none()
    : Option.some({ userUuid: identity.user_uuid, email: identity.email })
}).pipe(Effect.orDie)

// NOTE: 303 rather than 302, so the browser follows the form's POST with a
// GET at the Provider.
const authorizeResponse = Effect.gen(function* () {
  const { provider } = yield* HttpRouter.params
  if (!isProviderName(provider)) {
    return unknownProvider
  }
  const broadcaster = yield* readBroadcaster
  if (Option.isNone(broadcaster)) {
    return accessRequired
  }
  const request = yield* HttpServerRequest.HttpServerRequest
  const callbackUri = new URL(callbackPath(provider), request.originalUrl).toString()
  const connections = yield* Connections
  const consentUrl = yield* connections.startAuthorization(provider, broadcaster.value, callbackUri)
  return HttpServerResponse.redirect(consentUrl, { status: 303 })
})

// Route handlers run per request, so their services come from the router,
// not from the handler's build context. This hands the routes whatever
// `Connections` the surrounding Worker or test harness supplies.
const routes = Layer.mergeAll(
  HttpRouter.add("GET", "/setup/api/connections", connectionsResponse),
  HttpRouter.add("POST", "/oauth/:provider/authorize", authorizeResponse),
).pipe(HttpRouter.provideRequest(Layer.effect(Connections)(Connections)))

/**
 * The Worker's HTTP handler: the Access gate over the broadcaster path prefixes,
 * then the router.
 *
 * The router layer is built once and its scope closed immediately. That is
 * fine while the router holds no scoped resources; a scoped middleware or
 * service added to `routes` would need this scope to outlive the handler.
 */
export const BroadcasterHttp = HttpRouter.toHttpEffect(routes).pipe(
  Effect.map((router) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (isBroadcasterPath(pathOf(request.url))) {
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
