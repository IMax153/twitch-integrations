import { assert, describe, it } from "@effect/vitest"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import {
  ConnectionNotConfigured,
  ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as TestClock from "effect/testing/TestClock"
import { type ProviderFailureReason, ProviderRequestFailed } from "../src/Provider.ts"
import { makeBroadcasterWorld } from "./BroadcasterHarness.ts"
import type { TokenEndpoint } from "./FakeProviders.ts"
import { authorizedConnection, grantedScenario, pendingAttempt } from "./fixtures.ts"

const at = (iso: string) => TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(iso)))

/** A world at 12:55, holding a Connection for the Provider whose token has five minutes left. */
const worldDueForRefresh = (provider: ProviderName = "spotify") =>
  Effect.gen(function* () {
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

/** The ways a refresh can fail without the Provider having rejected the refresh token. */
const transientFailures: ReadonlyArray<{
  readonly name: string
  readonly token: TokenEndpoint
  readonly reason: ProviderFailureReason
}> = [
  {
    name: "a rate limit",
    token: { _tag: "Status", status: 429 },
    reason: { _tag: "Status", status: 429 },
  },
  {
    name: "a Provider outage",
    token: { _tag: "Status", status: 503 },
    reason: { _tag: "Status", status: 503 },
  },
  { name: "a network failure", token: { _tag: "Unreachable" }, reason: { _tag: "Transport" } },
  { name: "a malformed token response", token: { _tag: "Malformed" }, reason: { _tag: "Body" } },
]

describe("ConnectionObject.getAccessToken", () => {
  it.effect("fails Not Configured when the Provider has no Connection", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:00:00Z")
      const exit = yield* Effect.exit(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(exit, Exit.fail(new ConnectionNotConfigured({ provider: "spotify" })))
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
      const exit = yield* Effect.exit(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(exit, Exit.fail(new ReauthorizationRequired({ provider: "spotify" })))
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
          nextRefreshAt: Option.none(),
        }),
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
      const exit = yield* Effect.exit(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(exit, Exit.fail(new ReauthorizationRequired({ provider: "spotify" })))
      assert.deepStrictEqual(
        yield* world.stores.spotify.readConnection,
        Option.some({ ...authorizedConnection, status: "Reauthorization Required" }),
      )
      // Once rejected, the next request fails the same way without asking again.
      const again = yield* Effect.exit(world.objects.spotify.getAccessToken())
      assert.deepStrictEqual(again, Exit.fail(new ReauthorizationRequired({ provider: "spotify" })))
      assert.strictEqual((yield* world.providers.received).length, 1)
    }).pipe(Effect.scoped),
  )

  it.effect.each(transientFailures)(
    "reports $name and leaves the Connection as it was",
    ({ token, reason }) =>
      Effect.gen(function* () {
        const world = yield* worldDueForRefresh()
        yield* world.providers.set("spotify", { ...grantedScenario, token })
        const exit = yield* Effect.exit(world.objects.spotify.getAccessToken())
        assert.deepStrictEqual(
          exit,
          Exit.fail(
            new ProviderRequestFailed({ provider: "spotify", operation: "refresh", reason }),
          ),
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
