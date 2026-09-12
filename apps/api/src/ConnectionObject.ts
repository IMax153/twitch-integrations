import * as DoSqlite from "@effect/sql-sqlite-do/SqliteClient"
import type { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import {
  ConnectionSummary,
  type ConnectionSummaryEncoded,
} from "@twitch-integrations/domain/ConnectionSummary"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import type * as Crypto from "effect/Crypto"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type * as SqlClient from "effect/unstable/sql/SqlClient"
import { AuthorizationFlow } from "./AuthorizationFlow.ts"
import { ConnectionLifecycle } from "./ConnectionLifecycle.ts"
import {
  type AttemptClaim,
  type AttemptRejectionReason,
  type AuthorizationAttemptRejected,
  ConnectionStore,
} from "./ConnectionStore.ts"
import { Provider, type ProviderRequestFailed } from "./Provider.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"
import { RefreshAlarm } from "./RefreshAlarm.ts"
import * as WebCrypto from "./WebCrypto.ts"

/**
 * The RPC surface one Provider's Connection object exposes to the Worker. A
 * type alias rather than an interface so it satisfies Alchemy's RPC index
 * signature. Every member is a method: Alchemy's stub turns each property
 * access into a call, so a bare Effect member would not survive the RPC.
 */
export type ConnectionObjectShape = {
  /**
   * What the Broadcaster Page shows for this Provider, in its encoded form:
   * RPC results cross the Durable Object boundary by structured clone, which
   * keeps plain JSON intact but not `Option` or `DateTime` instances.
   */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly describe: () => Effect.Effect<ConnectionSummaryEncoded>
  /** Records an Authorization Attempt for the Broadcaster and returns the consent URL. */
  readonly startAuthorization: (
    broadcaster: BroadcasterIdentity,
    callbackUri: string,
  ) => Effect.Effect<string>
  /**
   * Completes the Attempt the claim names and reports the outcome the
   * Broadcaster Page should show. Every outcome is a result value rather
   * than a failure, since the Worker turns each one into a redirect.
   */
  readonly completeAuthorization: (
    claim: AttemptClaim,
    code: string,
  ) => Effect.Effect<BroadcasterResult>
  /**
   * Ends the Attempt the claim names after the Provider reported an error
   * instead of a code, and reports the outcome the Broadcaster Page should
   * show: denied when the Attempt was the Broadcaster's to end, otherwise
   * why the claim missed.
   */
  readonly abandonAuthorization: (claim: AttemptClaim) => Effect.Effect<BroadcasterResult>
  /**
   * A valid access token for the Connection, refreshed first when it is
   * about to expire. The plain string, since `Redacted` does not survive the
   * RPC boundary; the Worker wraps it again on arrival. Failures cross the
   * boundary as plain objects carrying their tag and fields.
   */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly getAccessToken: () => Effect.Effect<
    string,
    ConnectionNotConfigured | ReauthorizationRequired | ProviderRequestFailed
  >
  /**
   * The Durable Object alarm handler: runs the scheduled refresh. The
   * platform calls it when the alarm rings; tests call it directly.
   */
  readonly alarm: () => Effect.Effect<void>
}

/** The result the Broadcaster Page shows for each way a claim can miss its Attempt. */
const rejectionResult: Record<AttemptRejectionReason, BroadcasterResult> = {
  Expired: "attempt-expired",
  IdentityMismatch: "identity-mismatch",
  Mismatch: "attempt-mismatch",
}

/**
 * The object's behavior over its services, independent of Durable Object
 * hosting: production wraps it in the class below, tests build it directly
 * over an in-memory store and fake Credentials.
 */
export const makeConnectionObject = Effect.fnUntraced(function* (provider: ProviderName) {
  const store = yield* ConnectionStore
  const flow = yield* AuthorizationFlow
  const lifecycle = yield* ConnectionLifecycle
  // A rebuilt object honours the schedule its predecessor stored.
  yield* lifecycle.resumeSchedule
  const summary = (connection: Option.Option<Connection>): ConnectionSummary =>
    Option.match(connection, {
      onNone: () => ({
        provider,
        status: "Not Configured",
        connectedAccount: Option.none(),
        scopes: [],
        expiresAt: Option.none(),
        nextRefreshAt: Option.none(),
        lastRefreshError: Option.none(),
      }),
      onSome: (connection) => ({
        provider,
        status: connection.status,
        connectedAccount: Option.some(connection.connectedAccount),
        scopes: connection.scopes,
        expiresAt: Option.some(connection.expiresAt),
        nextRefreshAt: connection.nextRefreshAt,
        lastRefreshError: connection.lastRefreshError,
      }),
    })
  const rejected = (rejection: AuthorizationAttemptRejected) =>
    Effect.succeed(rejectionResult[rejection.reason])
  return {
    describe: () =>
      store.readConnection.pipe(Effect.map(summary), Effect.flatMap(encodeSummary), observed),
    startAuthorization: (broadcaster, callbackUri) =>
      observed(flow.start(broadcaster, callbackUri)),
    completeAuthorization: (claim, code) =>
      flow.complete(claim, code).pipe(
        Effect.as<BroadcasterResult>("connected"),
        Effect.catchTags({
          AuthorizationAttemptRejected: rejected,
          ProviderRequestFailed: () => Effect.succeed("exchange-failed" as const),
        }),
        observed,
      ),
    // A denial after the Attempt expired is still the Broadcaster's denial:
    // the expired Attempt cannot be used anyway, so the page reports what
    // they did rather than how long they took.
    abandonAuthorization: (claim) =>
      flow.abandon(claim).pipe(
        Effect.as<BroadcasterResult>("denied"),
        Effect.catchTag("AuthorizationAttemptRejected", (rejection) =>
          rejection.reason === "Expired" ? Effect.succeed("denied" as const) : rejected(rejection),
        ),
        observed,
      ),
    getAccessToken: () => observed(Effect.map(lifecycle.requestAccessToken, Redacted.value)),
    alarm: () => observed(lifecycle.runScheduledRefresh),
  } satisfies ConnectionObjectShape
})

/**
 * The object's whole layer graph over a `SqlClient`, the Provider
 * Credentials, an `HttpClient`, a `Crypto`, and the `RefreshAlarm`: the
 * store, the Provider chosen by name, the lifecycle, and the flow.
 */
export const connectionObjectLayer = (
  provider: ProviderName,
): Layer.Layer<
  ConnectionStore | AuthorizationFlow | ConnectionLifecycle,
  never,
  SqlClient.SqlClient | ProviderCredentials | HttpClient.HttpClient | Crypto.Crypto | RefreshAlarm
> =>
  AuthorizationFlow.layer.pipe(
    Layer.provideMerge(ConnectionLifecycle.layer),
    Layer.provideMerge(Layer.merge(ConnectionStore.layer, Provider.layer(provider))),
  )

const decodeProviderName = Schema.decodeUnknownEffect(ProviderName)

/** The summary's fields are all constructed here, so encoding cannot fail. */
const encodeSummary = (summary: ConnectionSummary) =>
  Effect.orDie(Schema.encodeEffect(ConnectionSummary)(summary))

/**
 * One Durable Object instance per Provider, addressed by Provider name. The
 * object hosts the store over its own SQLite storage, so each Provider's
 * Connection and Attempts live in their own database, and its refresh
 * schedule on its own alarm.
 */
export class ConnectionObject extends Cloudflare.DurableObject<ConnectionObject>()(
  "ConnectionObject",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState
    // Alchemy's constructor contract: the init Effect returns the Effect that
    // builds the instance, so the nested Effect here is intended.
    // oxlint-disable-next-line effecttsgo/return-effect-in-gen
    return observed(
      Effect.gen(function* () {
        // The object is only ever reached through `getByName(provider)`, so any
        // other name is a programming error rather than a request to refuse.
        const provider = yield* decodeProviderName(state.id.name).pipe(Effect.orDie)
        // The store lives as long as this in-memory instance. Its scope is
        // never closed on purpose: the adapter holds no finalizers, and workerd
        // evicts the whole isolate rather than signalling the instance.
        const instanceScope = yield* Scope.make()
        const services = yield* Layer.buildWithScope(
          connectionObjectLayer(provider).pipe(
            Layer.provide(DoSqlite.layer({ db: state.storage.sql.raw })),
            Layer.provide(ProviderCredentials.layer),
            Layer.provide(FetchHttpClient.layer),
            Layer.provide(WebCrypto.layer),
            Layer.provide(RefreshAlarm.layer),
            Layer.provide(Layer.succeed(Cloudflare.DurableObjectState, state)),
          ),
          instanceScope,
        )
        return yield* makeConnectionObject(provider).pipe(Effect.provide(services))
      }),
    )
  }),
) {}
