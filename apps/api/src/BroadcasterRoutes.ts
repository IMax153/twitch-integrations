import type { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
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
import { Channel } from "./Channel.ts"
import { Connections } from "./Connections.ts"
import type { AttemptClaim } from "./ConnectionStore.ts"

/**
 * Path prefixes that must carry an Access context. Cloudflare Access gates
 * the whole Worker at the edge; this check is the fail-closed backstop, so a
 * misconfigured application refuses rather than admits. The match is a plain
 * string prefix on purpose, so a path like `/setupx` is refused too.
 */
const broadcasterPathPrefixes = ["/setup", "/oauth"]

/** The Broadcaster Page, where every callback outcome sends the browser. */
const broadcasterPagePath = broadcasterPathPrefixes[0]

const pathOf = (url: string): string => url.split("?", 1)[0] ?? ""

const isBroadcasterPath = (path: string): boolean =>
  broadcasterPathPrefixes.some((prefix) => path.startsWith(prefix))

// The objects hand over summaries already encoded, so the response schema is
// the encoded side: the values pass through as they are.
const connectionSummaries = HttpServerResponse.schemaJson(
  Schema.Array(Schema.toEncoded(ConnectionSummary)),
)

const connectionsResponse = Effect.gen(function* () {
  const connections = yield* Connections
  const summaries = yield* Effect.forEach(ProviderName.literals, connections.describe)
  return yield* connectionSummaries(summaries, { headers: { "cache-control": "no-store" } })
})

const channelSummary = HttpServerResponse.schemaJson(Schema.toEncoded(ChannelMonitoring))

const channelResponse = Effect.gen(function* () {
  const channel = yield* Channel
  return yield* channelSummary(yield* channel.describe, {
    headers: { "cache-control": "no-store" },
  })
})

const accessRequired = HttpServerResponse.text("Access required", { status: 403 })

const unknownProvider = HttpServerResponse.text("Unknown Provider", { status: 404 })

const isProviderName = Schema.is(ProviderName)

/**
 * The callback URI the Provider redirects back to: the fixed callback path on
 * the origin the Broadcaster is using, so the same code works on localhost
 * and on the deployed hostname.
 */
const callbackUri = (origin: string, provider: ProviderName) =>
  new URL(`/oauth/${provider}/callback`, origin).toString()

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

/** What every OAuth route needs before it can act: the Provider, the Broadcaster, and the request URL. */
interface OAuthRequest {
  readonly provider: ProviderName
  readonly broadcaster: BroadcasterIdentity
  readonly url: URL
}

/**
 * Runs an OAuth route once its Provider and Broadcaster resolve, answering
 * 404 for an unknown Provider and 403 for an incomplete Access identity. An
 * arrow rather than `Effect.fn`, which cannot carry the type parameters.
 */
const oauthRoute = <E, R>(
  respond: (request: OAuthRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.gen(function* () {
    const { provider } = yield* HttpRouter.params
    if (!isProviderName(provider)) {
      return unknownProvider
    }
    const broadcaster = yield* readBroadcaster
    if (Option.isNone(broadcaster)) {
      return accessRequired
    }
    const request = yield* HttpServerRequest.HttpServerRequest
    return yield* respond({
      provider,
      broadcaster: broadcaster.value,
      url: new URL(request.originalUrl),
    })
  })

// NOTE: 303 rather than 302, so the browser follows the form's POST with a
// GET at the Provider.
const authorizeResponse = oauthRoute(({ provider, broadcaster, url }) =>
  Effect.gen(function* () {
    const connections = yield* Connections
    const consentUrl = yield* connections.startAuthorization(
      provider,
      broadcaster,
      callbackUri(url.origin, provider),
    )
    return HttpServerResponse.redirect(consentUrl, { status: 303 })
  }),
)

/** A redirect to the Broadcaster Page carrying the outcome as its result parameter. */
const broadcasterPageRedirect = (origin: string, result: BroadcasterResult) => {
  const page = new URL(broadcasterPagePath, origin)
  page.searchParams.set("result", result)
  return HttpServerResponse.redirect(page.toString(), { status: 303 })
}

/**
 * What the callback carries, decided before the object is involved: a
 * Provider that reports an error instead of a code, whatever the error, has
 * refused the authorization, and a Provider that reports neither has sent a
 * callback the Attempt cannot be finished from.
 */
const callbackResponse = oauthRoute(({ provider, broadcaster, url }) =>
  Effect.gen(function* () {
    const connections = yield* Connections
    const claim: AttemptClaim = {
      state: url.searchParams.get("state") ?? "",
      provider,
      callbackUri: callbackUri(url.origin, provider),
      broadcaster,
    }
    if (url.searchParams.has("error")) {
      const result = yield* connections.abandonAuthorization(provider, claim)
      return broadcasterPageRedirect(url.origin, result)
    }
    const code = url.searchParams.get("code")
    if (code === null) {
      return broadcasterPageRedirect(url.origin, "missing-code")
    }
    const result = yield* connections.completeAuthorization(provider, claim, code)
    if (result === "connected" && provider === "twitch") {
      yield* reconcileChannel
    }
    return broadcasterPageRedirect(url.origin, result)
  }),
)

/**
 * A fresh Twitch Connected Account gets the Reward and Event Subscriptions
 * before the browser is sent on. A failure is logged and does not change
 * the outcome the Broadcaster Page shows: the Connection is authorized
 * either way, and the next reconcile runs the same steps again.
 */
const reconcileChannel = Effect.gen(function* () {
  const channel = yield* Channel
  yield* channel.reconcile.pipe(
    Effect.tapError((failure) =>
      Effect.logError("Reconcile after Twitch authorization failed", failure),
    ),
    Effect.ignore,
  )
})

// Route handlers run per request, so their services come from the router,
// not from the handler's build context. This hands the routes whatever
// `Connections` and `Channel` the surrounding Worker or test harness supplies.
const routes = Layer.mergeAll(
  HttpRouter.add("GET", "/setup/api/connections", connectionsResponse),
  HttpRouter.add("GET", "/setup/api/channel", channelResponse),
  HttpRouter.add("POST", "/oauth/:provider/authorize", authorizeResponse),
  HttpRouter.add("GET", "/oauth/:provider/callback", callbackResponse),
).pipe(
  HttpRouter.provideRequest(
    Layer.merge(Layer.effect(Connections)(Connections), Layer.effect(Channel)(Channel)),
  ),
)

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
