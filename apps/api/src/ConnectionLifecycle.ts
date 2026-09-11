import type { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import type { Connection } from "@twitch-integrations/domain/Connection"
import {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import * as Semaphore from "effect/Semaphore"
import { ConnectionStore } from "./ConnectionStore.ts"
import { Provider, type ProviderRequestFailed, type TokenResponse } from "./Provider.ts"

export interface ConnectionLifecycleService {
  /**
   * Installs a token response as the Connection for the Connected Account.
   * A refresh token or scope list the Provider left out is carried over from
   * the previous Connection; with no refresh token anywhere the Connection is
   * Reauthorization Required, since it can never be refreshed.
   */
  readonly accept: (
    response: TokenResponse,
    connectedAccount: ConnectedAccount,
  ) => Effect.Effect<Connection>
  /**
   * Refreshes the Connection's access token now, whatever its expiry, and
   * installs the response under the same rules as `accept`. A refresh the
   * Provider rejects for any reason but rate limiting marks the Connection
   * Reauthorization Required; any other failure leaves it as it was.
   */
  readonly refresh: Effect.Effect<
    Connection,
    ConnectionNotConfigured | ReauthorizationRequired | ProviderRequestFailed
  >
  /**
   * A valid access token for the Connection: the stored one while more than
   * the refresh threshold remains, otherwise the result of a refresh. Fails
   * when there is no Connection or when the Provider has rejected the
   * refresh token.
   */
  readonly requestAccessToken: Effect.Effect<
    Redacted.Redacted<string>,
    ConnectionNotConfigured | ReauthorizationRequired | ProviderRequestFailed
  >
}

/** How close to expiry an access token is treated as no longer valid to hand out. */
const refreshThreshold = Duration.minutes(5)

/** Whether the token expires within the threshold, or already has. */
const dueForRefresh = (connection: Connection, now: DateTime.DateTime): boolean =>
  DateTime.toEpochMillis(connection.expiresAt) - DateTime.toEpochMillis(now) <=
  Duration.toMillis(refreshThreshold)

/**
 * Whether the Provider turned the refresh token down, as opposed to being
 * unreachable, rate limiting, or failing on its own side: any client error
 * other than a rate limit.
 */
const rejectedRefreshToken = (failure: ProviderRequestFailed): boolean =>
  failure.reason._tag === "Status" &&
  failure.reason.status >= 400 &&
  failure.reason.status < 500 &&
  failure.reason.status !== 429

/**
 * The Connection a token response produces, with the previous Connection
 * filling in what the response leaves out.
 */
const installed = (
  previous: Option.Option<Connection>,
  response: TokenResponse,
  connectedAccount: ConnectedAccount,
  now: DateTime.Utc,
): Connection => {
  const refreshToken = Option.orElse(response.refreshToken, () =>
    Option.flatMap(previous, (connection) => connection.refreshToken),
  )
  const scopes = Option.getOrElse(response.scopes, () =>
    Option.match(previous, { onNone: () => [], onSome: (connection) => connection.scopes }),
  )
  return {
    accessToken: response.accessToken,
    refreshToken,
    scopes,
    tokenType: response.tokenType,
    expiresAt: DateTime.addDuration(now, response.expiresIn),
    status: Option.isSome(refreshToken) ? "Authorized" : "Reauthorization Required",
    refreshRetryCount: 0,
    nextRefreshAt: Option.none(),
    lastRefreshError: Option.none(),
    connectedAccount,
  }
}

const make = Effect.gen(function* () {
  const store = yield* ConnectionStore
  const provider = yield* Provider
  const notConfigured = new ConnectionNotConfigured({ provider: provider.name })
  const reauthorizationRequired = new ReauthorizationRequired({ provider: provider.name })

  // NOTE: one permit, so a refresh and a token replacement never interleave
  // their read-then-write of the Connection, and concurrent token requests
  // queue behind one refresh rather than each starting their own.
  const lock = yield* Semaphore.make(1)

  /** The Connection with a refresh token the Provider has not rejected. */
  const readAuthorized: Effect.Effect<
    Connection,
    ConnectionNotConfigured | ReauthorizationRequired
  > = Effect.gen(function* () {
    const connection = yield* store.readConnection
    if (Option.isNone(connection)) {
      return yield* notConfigured
    }
    if (connection.value.status === "Reauthorization Required") {
      return yield* reauthorizationRequired
    }
    return connection.value
  })

  const requireReauthorization = (
    connection: Connection,
  ): Effect.Effect<never, ReauthorizationRequired> =>
    store
      .writeConnection({ ...connection, status: "Reauthorization Required" })
      .pipe(Effect.andThen(reauthorizationRequired))

  /** A rejected refresh token ends the Connection; any other failure is passed through. */
  const refreshFailed =
    (connection: Connection) =>
    (
      failure: ProviderRequestFailed,
    ): Effect.Effect<never, ReauthorizationRequired | ProviderRequestFailed> =>
      rejectedRefreshToken(failure) ? requireReauthorization(connection) : Effect.fail(failure)

  /** Contacts the Provider and installs the response. Runs under the lock. */
  const refreshConnection = (
    connection: Connection,
  ): Effect.Effect<Connection, ReauthorizationRequired | ProviderRequestFailed> =>
    Effect.gen(function* () {
      if (Option.isNone(connection.refreshToken)) {
        return yield* requireReauthorization(connection)
      }
      const response = yield* provider
        .refresh(connection.refreshToken.value)
        .pipe(Effect.catchTag("ProviderRequestFailed", refreshFailed(connection)))
      const now = yield* DateTime.now
      const refreshed = installed(
        Option.some(connection),
        response,
        connection.connectedAccount,
        now,
      )
      yield* store.writeConnection(refreshed)
      return refreshed
    })

  return ConnectionLifecycle.of({
    accept: (response, connectedAccount) =>
      lock.withPermit(
        Effect.gen(function* () {
          const previous = yield* store.readConnection
          const now = yield* DateTime.now
          const connection = installed(previous, response, connectedAccount, now)
          yield* store.writeConnection(connection)
          return connection
        }),
      ),
    refresh: lock.withPermit(Effect.flatMap(readAuthorized, refreshConnection)),
    requestAccessToken: Effect.gen(function* () {
      const connection = yield* readAuthorized
      if (!dueForRefresh(connection, yield* DateTime.now)) {
        return connection.accessToken
      }
      // NOTE: rechecked under the lock: a request that waited behind a
      // refresh finds the new token and must not refresh again.
      return yield* lock.withPermit(
        Effect.gen(function* () {
          const current = yield* readAuthorized
          if (!dueForRefresh(current, yield* DateTime.now)) {
            return current.accessToken
          }
          return (yield* refreshConnection(current)).accessToken
        }),
      )
    }),
  })
})

/** The rules for how one Provider's Connection changes over time. All time comes from the Clock. */
export class ConnectionLifecycle extends Context.Service<
  ConnectionLifecycle,
  ConnectionLifecycleService
>()("@twitch-integrations/api/ConnectionLifecycle") {
  static readonly layer: Layer.Layer<ConnectionLifecycle, never, ConnectionStore | Provider> =
    Layer.effect(ConnectionLifecycle)(make)
}
