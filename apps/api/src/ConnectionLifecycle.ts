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
import {
  Provider,
  type ProviderRequestFailed,
  type TokenResponse,
  describeFailure,
  isClientRejection,
  isMomentary,
} from "./Provider.ts"
import { RefreshAlarm } from "./RefreshAlarm.ts"

export interface ConnectionLifecycleService {
  /**
   * Installs a token response as the Connection for the Connected Account
   * and schedules its refresh, replacing any schedule the previous
   * Connection had. A refresh token or scope list the Provider left out is
   * carried over from the previous Connection; with no refresh token
   * anywhere the Connection is Reauthorization Required, since it can never
   * be refreshed, and nothing is scheduled.
   */
  readonly accept: (
    response: TokenResponse,
    connectedAccount: ConnectedAccount,
  ) => Effect.Effect<Connection>
  /**
   * Refreshes the Connection's access token now, whatever its expiry, and
   * installs the response under the same rules as `accept`. A refresh the
   * Provider rejects for any reason but rate limiting marks the Connection
   * Reauthorization Required and ends its schedule; any other failure leaves
   * it as it was.
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
  /**
   * What the alarm does when it rings: runs the refresh once the stored next
   * refresh time has come, then schedules whatever follows, the next refresh
   * or a retry. Every expected failure ends in a schedule rather than an
   * error, so the platform's own alarm retry only ever answers a defect.
   */
  readonly runScheduledRefresh: Effect.Effect<void>
  /**
   * Arms the alarm for the stored next refresh time, if there is one. Run
   * when the object is built, so a schedule written by an instance that died
   * before arming its alarm is still honoured; arming for a time already
   * armed changes nothing.
   */
  readonly resumeSchedule: Effect.Effect<void>
}

/**
 * How close to expiry an access token is treated as no longer valid to hand
 * out, and so how far before expiry the scheduled refresh runs.
 */
const refreshThreshold = Duration.minutes(5)

/** The soonest a refresh may be scheduled, so a token already within the threshold still gets one. */
const minimumAlarmDelay = Duration.seconds(1)

/** How long to wait after each momentary failure in turn, before falling back to the long retry. */
const shortRetryDelays: ReadonlyArray<Duration.Duration> = [
  Duration.minutes(1),
  Duration.minutes(2),
  Duration.minutes(4),
]

/** How long to wait after a failure the short retries did not cure, or one they do not cover. */
const longRetryDelay = Duration.minutes(10)

/** Whether the token expires within the threshold, or already has. */
const dueForRefresh = (connection: Connection, now: DateTime.DateTime): boolean =>
  DateTime.toEpochMillis(connection.expiresAt) - DateTime.toEpochMillis(now) <=
  Duration.toMillis(refreshThreshold)

/** When an Authorized Connection's refresh runs: the threshold before expiry, but never sooner than the minimum delay from now. */
const refreshTime = (connection: Connection, now: DateTime.Utc): DateTime.Utc =>
  DateTime.max(
    DateTime.subtractDuration(connection.expiresAt, refreshThreshold),
    DateTime.addDuration(now, minimumAlarmDelay),
  )

interface Retry {
  readonly delay: Duration.Duration
  readonly retryCount: number
}

/**
 * What follows a failed refresh: the next short retry while the failure is
 * momentary and short retries remain, otherwise the long retry with the
 * count started over.
 */
const retryAfter = (retryCount: number, failure: ProviderRequestFailed): Retry => {
  const short = isMomentary(failure) ? shortRetryDelays[retryCount] : undefined
  return short === undefined
    ? { delay: longRetryDelay, retryCount: 0 }
    : { delay: short, retryCount: retryCount + 1 }
}

/** A Connection that can be refreshed, with its refresh token to hand. */
interface Refreshable {
  readonly connection: Connection
  readonly refreshToken: Redacted.Redacted<string>
}

/**
 * The Connection with the refresh token the Provider has not rejected, if
 * it has one. A stored Connection with no refresh token is treated as
 * Reauthorization Required whatever its status says, since it can never be
 * refreshed.
 */
const refreshableOf = (connection: Connection): Option.Option<Refreshable> =>
  connection.status === "Reauthorization Required"
    ? Option.none()
    : Option.map(connection.refreshToken, (refreshToken) => ({ connection, refreshToken }))

/**
 * The Connection a token response produces, with the previous Connection
 * filling in what the response leaves out.
 */
const connectionFrom = (
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
  const alarm = yield* RefreshAlarm
  const notConfigured = ConnectionNotConfigured.make({ provider: provider.name })
  const reauthorizationRequired = ReauthorizationRequired.make({ provider: provider.name })

  // NOTE: one permit, so a refresh, a token replacement, and the alarm never
  // interleave their read-then-write of the Connection, and concurrent token
  // requests queue behind one refresh rather than each starting their own.
  const lock = yield* Semaphore.make(1)

  const readRefreshable: Effect.Effect<
    Refreshable,
    ConnectionNotConfigured | ReauthorizationRequired
  > = Effect.gen(function* () {
    const stored = yield* store.readConnection
    if (Option.isNone(stored)) {
      return yield* notConfigured
    }
    const refreshable = refreshableOf(stored.value)
    if (Option.isNone(refreshable)) {
      return yield* reauthorizationRequired
    }
    return refreshable.value
  })

  /**
   * Stores the Connection with its next refresh at the time, then arms the
   * alarm for it: in that order, so an object evicted between the two
   * resumes from what it stored rather than from an alarm it cannot explain.
   */
  const scheduleAt = Effect.fnUntraced(function* (connection: Connection, at: DateTime.Utc) {
    const scheduled: Connection = { ...connection, nextRefreshAt: Option.some(at) }
    yield* store.writeConnection(scheduled)
    yield* alarm.schedule(at)
    return scheduled
  })

  /** Stores the Connection with no refresh ahead of it and disarms the alarm. */
  const unschedule = Effect.fnUntraced(function* (connection: Connection) {
    const settled: Connection = { ...connection, nextRefreshAt: Option.none() }
    yield* store.writeConnection(settled)
    yield* alarm.cancel
    return settled
  })

  /** Installs a new Connection: with its refresh scheduled when it can be refreshed, otherwise with none. */
  const install = (connection: Connection, now: DateTime.Utc): Effect.Effect<Connection> =>
    connection.status === "Authorized"
      ? scheduleAt(connection, refreshTime(connection, now))
      : unschedule(connection)

  /** What the Connection remembers of a failed refresh. */
  const refreshErrorOf = (failure: ProviderRequestFailed, now: DateTime.Utc) =>
    Option.some({ message: describeFailure(failure), at: now })

  /** A rejected refresh token ends the Connection and its schedule; any other failure is passed through. */
  const refreshFailed =
    (connection: Connection) =>
    (
      failure: ProviderRequestFailed,
    ): Effect.Effect<never, ReauthorizationRequired | ProviderRequestFailed> =>
      isClientRejection(failure)
        ? Effect.gen(function* () {
            const now = yield* DateTime.now
            yield* unschedule({
              ...connection,
              status: "Reauthorization Required",
              lastRefreshError: refreshErrorOf(failure, now),
            })
            return yield* reauthorizationRequired
          })
        : Effect.fail(failure)

  /** Contacts the Provider and installs the response. Runs under the lock. */
  const refreshConnection = Effect.fn("ConnectionLifecycle.refresh")(function* ({
    connection,
    refreshToken,
  }: Refreshable) {
    const response = yield* provider
      .refresh(refreshToken)
      .pipe(Effect.catchTag("ProviderRequestFailed", refreshFailed(connection)))
    const now = yield* DateTime.now
    const refreshed = connectionFrom(
      Option.some(connection),
      response,
      connection.connectedAccount,
      now,
    )
    return yield* install(refreshed, now)
  })

  /** Records the failure on the Connection and schedules the retry the policy calls for. */
  const scheduleRetry = Effect.fnUntraced(function* (
    connection: Connection,
    failure: ProviderRequestFailed,
  ) {
    const now = yield* DateTime.now
    const { delay, retryCount } = retryAfter(connection.refreshRetryCount, failure)
    yield* scheduleAt(
      {
        ...connection,
        refreshRetryCount: retryCount,
        lastRefreshError: refreshErrorOf(failure, now),
      },
      DateTime.addDuration(now, delay),
    )
  })

  const resumeSchedule: Effect.Effect<void> = lock.withPermit(
    Effect.gen(function* () {
      const stored = yield* store.readConnection
      const nextRefreshAt = Option.flatMap(stored, (connection) => connection.nextRefreshAt)
      if (Option.isSome(nextRefreshAt)) {
        yield* alarm.schedule(nextRefreshAt.value)
      }
    }),
  )

  const runScheduledRefresh: Effect.Effect<void> = lock.withPermit(
    Effect.gen(function* () {
      const stored = yield* store.readConnection
      // Nothing is scheduled: the ring outlived the schedule that set it.
      if (Option.isNone(stored) || Option.isNone(stored.value.nextRefreshAt)) {
        return
      }
      const connection = stored.value
      const nextRefreshAt = stored.value.nextRefreshAt.value
      const refreshable = refreshableOf(connection)
      // A schedule the Connection can no longer honour ends here, with the
      // status saying why so the Broadcaster Page can too.
      if (Option.isNone(refreshable)) {
        yield* unschedule({ ...connection, status: "Reauthorization Required" })
        return
      }
      const now = yield* DateTime.now
      // NOTE: the stored time is the schedule; an alarm that rings ahead of
      // it, as after the object was evicted and rebuilt, re-arms for it.
      if (DateTime.toEpochMillis(nextRefreshAt) > DateTime.toEpochMillis(now)) {
        yield* alarm.schedule(nextRefreshAt)
        return
      }
      yield* refreshConnection(refreshable.value).pipe(
        Effect.asVoid,
        Effect.catchTags({
          // The rejection has already ended the schedule.
          ReauthorizationRequired: () => Effect.void,
          ProviderRequestFailed: (failure) => scheduleRetry(connection, failure),
        }),
      )
    }),
  )

  /**
   * The stored token while it is fresh, otherwise whatever `onDue` makes of
   * the Connection. An arrow rather than `Effect.fn`, which cannot carry the
   * type parameter.
   */
  const tokenUnlessDue = <E>(
    onDue: (refreshable: Refreshable) => Effect.Effect<Redacted.Redacted<string>, E>,
  ): Effect.Effect<
    Redacted.Redacted<string>,
    ConnectionNotConfigured | ReauthorizationRequired | E
  > =>
    Effect.gen(function* () {
      const refreshable = yield* readRefreshable
      const now = yield* DateTime.now
      return dueForRefresh(refreshable.connection, now)
        ? yield* onDue(refreshable)
        : refreshable.connection.accessToken
    })

  return ConnectionLifecycle.of({
    accept: (response, connectedAccount) =>
      lock.withPermit(
        Effect.gen(function* () {
          const previous = yield* store.readConnection
          const now = yield* DateTime.now
          return yield* install(connectionFrom(previous, response, connectedAccount, now), now)
        }),
      ),
    refresh: lock.withPermit(Effect.flatMap(readRefreshable, refreshConnection)),
    // NOTE: checked again under the lock: a request that waited behind a
    // refresh finds the new token and must not refresh again.
    requestAccessToken: tokenUnlessDue(() =>
      lock.withPermit(
        tokenUnlessDue((refreshable) =>
          Effect.map(refreshConnection(refreshable), (refreshed) => refreshed.accessToken),
        ),
      ),
    ),
    runScheduledRefresh,
    resumeSchedule,
  })
})

/** The rules for how one Provider's Connection changes over time. All time comes from the Clock. */
export class ConnectionLifecycle extends Context.Service<
  ConnectionLifecycle,
  ConnectionLifecycleService
>()("@twitch-integrations/api/ConnectionLifecycle") {
  static readonly layer: Layer.Layer<
    ConnectionLifecycle,
    never,
    ConnectionStore | Provider | RefreshAlarm
  > = Layer.effect(ConnectionLifecycle)(make)
}
