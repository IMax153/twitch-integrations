import { assert, describe, it } from "@effect/vitest"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as TestClock from "effect/testing/TestClock"
import { type ProviderFailureReason, ProviderRequestFailed } from "../src/Provider.ts"
import { makeBroadcasterWorld } from "./BroadcasterHarness.ts"
import type { TokenEndpoint } from "./FakeProviders.ts"
import {
  authorizedConnection,
  grantedScenario,
  grantedTokens,
  pendingAttempt,
  strugglingConnection,
} from "./fixtures.ts"

const at = (iso: string) => TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(iso)))

const time = (iso: string) => DateTime.makeUnsafe(iso)

/** What a refresh leaves behind about its scheduling and its last failure. */
type Schedule = Pick<
  Connection,
  "status" | "refreshRetryCount" | "nextRefreshAt" | "lastRefreshError"
>

const schedule = ({
  status,
  refreshRetryCount,
  nextRefreshAt,
  lastRefreshError,
}: Connection): Schedule => ({ status, refreshRetryCount, nextRefreshAt, lastRefreshError })

const assertSchedule = (stored: Option.Option<Connection>, expected: Schedule) =>
  assert.deepStrictEqual(Option.map(stored, schedule), Option.some(expected))

/** A world at 12:55, holding a Connection for the Provider whose token has five minutes left. */
const worldDueForRefresh = Effect.fnUntraced(function* (provider: ProviderName = "spotify") {
  const world = yield* makeBroadcasterWorld
  yield* at("2026-09-11T12:55:00Z")
  yield* world.stores[provider].writeConnection(authorizedConnection)
  return world
})

/** What a refresh response may leave out, and so must carry over from the previous Connection. */
const carriedOver = (connection: Connection) => ({
  refreshToken: connection.refreshToken,
  scopes: connection.scopes,
  status: connection.status,
})

/**
 * The ways a refresh can fail without the Provider having rejected the
 * refresh token, with what the Connection records about each and whether a
 * short wait is expected to cure it.
 */
const transientFailures: ReadonlyArray<{
  readonly name: string
  readonly token: TokenEndpoint
  readonly reason: ProviderFailureReason
  readonly message: string
  readonly momentary: boolean
}> = [
  {
    name: "a rate limit",
    token: { _tag: "Status", status: 429 },
    reason: { _tag: "Status", status: 429 },
    message: "The Spotify refresh request was answered with status 429.",
    momentary: true,
  },
  {
    name: "a Provider outage",
    token: { _tag: "Status", status: 503 },
    reason: { _tag: "Status", status: 503 },
    message: "The Spotify refresh request was answered with status 503.",
    momentary: false,
  },
  {
    name: "a network failure",
    token: { _tag: "Unreachable" },
    reason: { _tag: "Transport" },
    message: "The Spotify refresh request got no answer.",
    momentary: true,
  },
  {
    name: "a malformed token response",
    token: { _tag: "Malformed" },
    reason: { _tag: "Body" },
    message: "The Spotify refresh request was answered with an unexpected body.",
    momentary: false,
  },
]

describe("ConnectionObject.getAccessToken", () => {
  it.effect("fails Not Configured when the Provider has no Connection", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:00:00Z")
      const failure = yield* Effect.flip(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(failure, new ConnectionNotConfigured({ provider: "spotify" }))
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("fails Reauthorization Required without contacting the Provider", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:58:00Z")
      yield* world.stores.spotify.writeConnection({
        ...authorizedConnection,
        status: "Reauthorization Required",
      })
      const failure = yield* Effect.flip(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(failure, new ReauthorizationRequired({ provider: "spotify" }))
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("returns the stored token while more than five minutes remain", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:54:59Z")
      yield* world.stores.spotify.writeConnection(authorizedConnection)
      const token = yield* world.objects.spotify.getAccessToken()
      assert.strictEqual(token, "access-token-1")
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("refreshes, persists, and returns the new token with five minutes left", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.providers.set("spotify", grantedScenario)
      const token = yield* world.objects.spotify.getAccessToken()
      assert.strictEqual(token, "granted-access-token")
      const received = yield* world.providers.received
      assert.strictEqual(received.length, 1)
      assert.strictEqual(received[0]?.url, "https://accounts.spotify.com/api/token")
      assert.deepStrictEqual(received[0]?.form, {
        grant_type: "refresh_token",
        refresh_token: "refresh-token-1",
      })
      assert.strictEqual(
        received[0]?.headers["authorization"],
        `Basic ${btoa("spotify-client-id:spotify-client-secret")}`,
      )
      assert.deepStrictEqual(
        yield* world.stores.spotify.readConnection,
        Option.some({
          ...authorizedConnection,
          accessToken: Redacted.make("granted-access-token"),
          refreshToken: Option.some(Redacted.make("granted-refresh-token")),
          scopes: ["scope-a", "scope-b"],
          tokenType: "Bearer",
          expiresAt: DateTime.makeUnsafe("2026-09-11T13:55:00Z"),
          nextRefreshAt: Option.some(time("2026-09-11T13:50:00Z")),
        }),
      )
      // The refresh moved the token's expiry, so the alarm moves with it.
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T13:50:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("refreshes with Twitch using the Credentials in the form body", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh("twitch")
      yield* world.providers.set("twitch", grantedScenario)
      const token = yield* world.objects.twitch.getAccessToken()
      assert.strictEqual(token, "granted-access-token")
      const received = yield* world.providers.received
      assert.strictEqual(received.length, 1)
      assert.strictEqual(received[0]?.url, "https://id.twitch.tv/oauth2/token")
      assert.deepStrictEqual(received[0]?.form, {
        grant_type: "refresh_token",
        refresh_token: "refresh-token-1",
        client_id: "twitch-client-id",
        client_secret: "twitch-client-secret",
      })
      assert.strictEqual(received[0]?.headers["authorization"], undefined)
    }).pipe(Effect.scoped),
  )

  it.effect("keeps the previous refresh token and scopes when the refresh omits them", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.providers.set("spotify", {
        ...grantedScenario,
        token: {
          _tag: "Grant",
          grant: {
            accessToken: "granted-access-token",
            refreshToken: Option.none(),
            expiresIn: 3600,
            scopes: Option.none(),
          },
        },
      })
      const token = yield* world.objects.spotify.getAccessToken()
      assert.strictEqual(token, "granted-access-token")
      const stored = yield* world.stores.spotify.readConnection
      assert.deepStrictEqual(
        Option.map(stored, (connection) => connection.accessToken),
        Option.some(Redacted.make("granted-access-token")),
      )
      assert.deepStrictEqual(
        Option.map(stored, carriedOver),
        Option.some(carriedOver(authorizedConnection)),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("becomes Reauthorization Required when the Provider rejects the refresh token", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.providers.set("spotify", {
        ...grantedScenario,
        token: { _tag: "Status", status: 400 },
      })
      const failure = yield* Effect.flip(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(failure, new ReauthorizationRequired({ provider: "spotify" }))
      assert.deepStrictEqual(
        yield* world.stores.spotify.readConnection,
        Option.some({
          ...authorizedConnection,
          status: "Reauthorization Required",
          nextRefreshAt: Option.none(),
          lastRefreshError: Option.some({
            message: "The Spotify refresh request was answered with status 400.",
            at: time("2026-09-11T12:55:00Z"),
          }),
        }),
      )
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
      // Once rejected, the next request fails the same way without asking again.
      const again = yield* Effect.flip(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(again, new ReauthorizationRequired({ provider: "spotify" }))
      assert.strictEqual((yield* world.providers.received).length, 1)
    }).pipe(Effect.scoped),
  )

  it.effect.each(transientFailures)(
    "reports $name and leaves the Connection as it was",
    ({ token, reason }) =>
      Effect.gen(function* () {
        const world = yield* worldDueForRefresh()
        yield* world.providers.set("spotify", { ...grantedScenario, token })
        const failure = yield* Effect.flip(world.objects.spotify.getAccessToken())
        assert.deepStrictEqual(
          failure,
          new ProviderRequestFailed({ provider: "spotify", operation: "refresh", reason }),
        )
        assert.deepStrictEqual(
          yield* world.stores.spotify.readConnection,
          Option.some(authorizedConnection),
        )
      }).pipe(Effect.scoped),
  )

  it.effect("shares one in-flight refresh between concurrent requests", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.providers.set("spotify", { ...grantedScenario, latency: "1 second" })
      const first = yield* Effect.forkChild(world.objects.spotify.getAccessToken(), {
        startImmediately: true,
      })
      const second = yield* Effect.forkChild(world.objects.spotify.getAccessToken(), {
        startImmediately: true,
      })
      yield* TestClock.adjust("1 second")
      const tokens = yield* Effect.all([Fiber.join(first), Fiber.join(second)])
      assert.deepStrictEqual(tokens, ["granted-access-token", "granted-access-token"])
      assert.strictEqual((yield* world.providers.received).length, 1)
    }).pipe(Effect.scoped),
  )

  it.effect("lets a reconnect wait for an in-flight refresh rather than interleave", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.stores.spotify.createAttempt({
        ...pendingAttempt,
        expiresAt: DateTime.makeUnsafe("2026-09-11T13:05:00Z"),
      })
      yield* world.providers.set("spotify", { ...grantedScenario, latency: "1 second" })
      const refresh = yield* Effect.forkChild(world.objects.spotify.getAccessToken(), {
        startImmediately: true,
      })
      // The reconnect's exchange answers at once with different tokens, so
      // whichever write lands last decides what the Connection holds.
      yield* world.providers.set("spotify", {
        token: {
          _tag: "Grant",
          grant: {
            accessToken: "reconnect-access-token",
            refreshToken: Option.some("reconnect-refresh-token"),
            expiresIn: 3600,
            scopes: Option.some(["scope-c"]),
          },
        },
        account: { id: "account-2", displayName: "Max again" },
      })
      const { state, provider, callbackUri, broadcaster } = pendingAttempt
      const reconnect = yield* Effect.forkChild(
        world.objects.spotify.completeAuthorization(
          { state, provider, callbackUri, broadcaster },
          "code-1",
        ),
        { startImmediately: true },
      )
      yield* TestClock.adjust("1 second")
      const outcomes = yield* Effect.all([Fiber.join(refresh), Fiber.join(reconnect)])
      assert.deepStrictEqual(outcomes, ["granted-access-token", "connected"])
      const stored = yield* world.stores.spotify.readConnection
      assert.deepStrictEqual(
        Option.map(stored, (connection) => ({
          accessToken: connection.accessToken,
          connectedAccount: connection.connectedAccount,
        })),
        Option.some({
          accessToken: Redacted.make("reconnect-access-token"),
          connectedAccount: { id: "account-2", displayName: "Max again" },
        }),
      )
    }).pipe(Effect.scoped),
  )
})

/** The claim the callback presents for the pending Attempt. */
const pendingClaim = {
  state: pendingAttempt.state,
  provider: pendingAttempt.provider,
  callbackUri: pendingAttempt.callbackUri,
  broadcaster: pendingAttempt.broadcaster,
}

/** A world at noon with a pending Attempt, ready to complete an authorization. */
const worldWithAttempt = Effect.gen(function* () {
  const world = yield* makeBroadcasterWorld
  yield* at("2026-09-11T12:00:00Z")
  yield* world.stores.spotify.createAttempt(pendingAttempt)
  return world
})

describe("ConnectionObject.completeAuthorization scheduling", () => {
  it.effect("schedules the first refresh five minutes before the token expires", () =>
    Effect.gen(function* () {
      const world = yield* worldWithAttempt
      yield* world.providers.set("spotify", grantedScenario)
      yield* world.objects.spotify.completeAuthorization(pendingClaim, "code-1")
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Authorized",
        refreshRetryCount: 0,
        nextRefreshAt: Option.some(time("2026-09-11T12:55:00Z")),
        lastRefreshError: Option.none(),
      })
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:55:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("schedules a token already within the threshold one second out", () =>
    Effect.gen(function* () {
      const world = yield* worldWithAttempt
      yield* world.providers.set("spotify", {
        ...grantedScenario,
        token: { _tag: "Grant", grant: { ...grantedTokens, expiresIn: 60 } },
      })
      yield* world.objects.spotify.completeAuthorization(pendingClaim, "code-1")
      assert.deepStrictEqual(
        Option.flatMap(yield* world.stores.spotify.readConnection, (c) => c.nextRefreshAt),
        Option.some(time("2026-09-11T12:00:01Z")),
      )
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:00:01Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("replaces a pending retry schedule with the new token's", () =>
    Effect.gen(function* () {
      const world = yield* worldWithAttempt
      yield* world.stores.spotify.writeConnection(strugglingConnection)
      yield* world.providers.set("spotify", grantedScenario)
      yield* world.objects.spotify.completeAuthorization(pendingClaim, "code-1")
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Authorized",
        refreshRetryCount: 0,
        nextRefreshAt: Option.some(time("2026-09-11T12:55:00Z")),
        lastRefreshError: Option.none(),
      })
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:55:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("schedules nothing for a Connection that cannot be refreshed", () =>
    Effect.gen(function* () {
      const world = yield* worldWithAttempt
      yield* world.providers.set("spotify", {
        ...grantedScenario,
        token: {
          _tag: "Grant",
          grant: { ...grantedTokens, refreshToken: Option.none() },
        },
      })
      yield* world.objects.spotify.completeAuthorization(pendingClaim, "code-1")
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Reauthorization Required",
        refreshRetryCount: 0,
        nextRefreshAt: Option.none(),
        lastRefreshError: Option.none(),
      })
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
    }).pipe(Effect.scoped),
  )
})

describe("ConnectionObject.alarm", () => {
  it.effect("refreshes when the stored time has come and schedules the next refresh", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.providers.set("spotify", grantedScenario)
      yield* world.objects.spotify.alarm()
      const received = yield* world.providers.received
      assert.strictEqual(received.length, 1)
      assert.deepStrictEqual(received[0]?.form, {
        grant_type: "refresh_token",
        refresh_token: "refresh-token-1",
      })
      assert.deepStrictEqual(
        yield* world.stores.spotify.readConnection,
        Option.some({
          ...authorizedConnection,
          accessToken: Redacted.make("granted-access-token"),
          refreshToken: Option.some(Redacted.make("granted-refresh-token")),
          scopes: ["scope-a", "scope-b"],
          expiresAt: time("2026-09-11T13:55:00Z"),
          nextRefreshAt: Option.some(time("2026-09-11T13:50:00Z")),
        }),
      )
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T13:50:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("resets the retry count and clears the error once a retry succeeds", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:04:00Z")
      yield* world.stores.spotify.writeConnection(strugglingConnection)
      yield* world.providers.set("spotify", grantedScenario)
      yield* world.objects.spotify.alarm()
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Authorized",
        refreshRetryCount: 0,
        nextRefreshAt: Option.some(time("2026-09-11T12:59:00Z")),
        lastRefreshError: Option.none(),
      })
    }).pipe(Effect.scoped),
  )

  it.effect("does nothing without a Connection", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:55:00Z")
      yield* world.objects.spotify.alarm()
      assert.deepStrictEqual(yield* world.providers.received, [])
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
    }).pipe(Effect.scoped),
  )

  it.effect("re-arms itself when it rings before the stored time", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:50:00Z")
      yield* world.stores.spotify.writeConnection(authorizedConnection)
      yield* world.objects.spotify.alarm()
      assert.deepStrictEqual(yield* world.providers.received, [])
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:55:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("clears a stale schedule on a Connection that needs reauthorization", () =>
    Effect.gen(function* () {
      const world = yield* worldDueForRefresh()
      yield* world.stores.spotify.writeConnection({
        ...authorizedConnection,
        status: "Reauthorization Required",
      })
      yield* world.objects.spotify.alarm()
      assert.deepStrictEqual(yield* world.providers.received, [])
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Reauthorization Required",
        refreshRetryCount: 0,
        nextRefreshAt: Option.none(),
        lastRefreshError: Option.none(),
      })
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
    }).pipe(Effect.scoped),
  )

  it.effect.each(transientFailures.filter((failure) => failure.momentary))(
    "retries $name after one, two, and four minutes, then every ten, then starts over",
    ({ token, message }) =>
      Effect.gen(function* () {
        const world = yield* worldDueForRefresh()
        yield* world.providers.set("spotify", { ...grantedScenario, token })
        const expected: ReadonlyArray<readonly [ring: string, next: string, count: number]> = [
          ["2026-09-11T12:55:00Z", "2026-09-11T12:56:00Z", 1],
          ["2026-09-11T12:56:00Z", "2026-09-11T12:58:00Z", 2],
          ["2026-09-11T12:58:00Z", "2026-09-11T13:02:00Z", 3],
          ["2026-09-11T13:02:00Z", "2026-09-11T13:12:00Z", 0],
          ["2026-09-11T13:12:00Z", "2026-09-11T13:13:00Z", 1],
        ]
        for (const [ring, next, count] of expected) {
          yield* at(ring)
          yield* world.objects.spotify.alarm()
          const stored = yield* world.stores.spotify.readConnection
          assertSchedule(stored, {
            status: "Authorized",
            refreshRetryCount: count,
            nextRefreshAt: Option.some(time(next)),
            lastRefreshError: Option.some({ message, at: time(ring) }),
          })
          assert.deepStrictEqual(
            Option.map(stored, (connection) => connection.accessToken),
            Option.some(Redacted.make("access-token-1")),
          )
          assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.some(time(next)))
        }
        assert.strictEqual((yield* world.providers.received).length, expected.length)
      }).pipe(Effect.scoped),
  )

  it.effect.each(transientFailures.filter((failure) => !failure.momentary))(
    "retries $name after ten minutes and starts the short retries over",
    ({ token, message }) =>
      Effect.gen(function* () {
        const world = yield* worldDueForRefresh()
        yield* world.stores.spotify.writeConnection({
          ...authorizedConnection,
          refreshRetryCount: 1,
        })
        yield* world.providers.set("spotify", { ...grantedScenario, token })
        yield* world.objects.spotify.alarm()
        assertSchedule(yield* world.stores.spotify.readConnection, {
          status: "Authorized",
          refreshRetryCount: 0,
          nextRefreshAt: Option.some(time("2026-09-11T13:05:00Z")),
          lastRefreshError: Option.some({ message, at: time("2026-09-11T12:55:00Z") }),
        })
        assert.deepStrictEqual(
          yield* world.alarms.spotify.armedFor,
          Option.some(time("2026-09-11T13:05:00Z")),
        )
      }).pipe(Effect.scoped),
  )

  it.effect("marks Reauthorization Required and disarms when the refresh token is rejected", () =>
    Effect.gen(function* () {
      const world = yield* worldWithAttempt
      yield* world.providers.set("spotify", grantedScenario)
      yield* world.objects.spotify.completeAuthorization(pendingClaim, "code-1")
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:55:00Z")),
      )
      yield* at("2026-09-11T12:55:00Z")
      yield* world.providers.set("spotify", {
        ...grantedScenario,
        token: { _tag: "Status", status: 401 },
      })
      yield* world.objects.spotify.alarm()
      assertSchedule(yield* world.stores.spotify.readConnection, {
        status: "Reauthorization Required",
        refreshRetryCount: 0,
        nextRefreshAt: Option.none(),
        lastRefreshError: Option.some({
          message: "The Spotify refresh request was answered with status 401.",
          at: time("2026-09-11T12:55:00Z"),
        }),
      })
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
      // A later ring finds nothing scheduled and leaves the Provider alone.
      yield* world.objects.spotify.alarm()
      assert.strictEqual((yield* world.providers.received).length, 3)
    }).pipe(Effect.scoped),
  )
})

describe("ConnectionObject construction", () => {
  it.effect("re-arms the alarm for the stored next refresh time", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:30:00Z")
      // The previous instance stored the schedule but died before arming it.
      yield* world.stores.spotify.writeConnection(authorizedConnection)
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
      yield* world.rebuildObject("spotify")
      assert.deepStrictEqual(
        yield* world.alarms.spotify.armedFor,
        Option.some(time("2026-09-11T12:55:00Z")),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("leaves the alarm alone when nothing is scheduled", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* world.stores.spotify.writeConnection({
        ...authorizedConnection,
        status: "Reauthorization Required",
        nextRefreshAt: Option.none(),
      })
      yield* world.rebuildObject("spotify")
      assert.deepStrictEqual(yield* world.alarms.spotify.armedFor, Option.none())
      yield* world.rebuildObject("twitch")
      assert.deepStrictEqual(yield* world.alarms.twitch.armedFor, Option.none())
    }).pipe(Effect.scoped),
  )
})
