import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as TestClock from "effect/testing/TestClock"
import { ConnectionLifecycle } from "../src/ConnectionLifecycle.ts"
import { ConnectionStore } from "../src/ConnectionStore.ts"
import { Provider, type TokenResponse } from "../src/Provider.ts"
import { FakeProviders } from "./FakeProviders.ts"
import { FakeRefreshAlarm } from "./FakeRefreshAlarm.ts"
import { authorizedConnection, strugglingConnection } from "./fixtures.ts"

/** A full token response: fresh tokens, an hour of validity, and a granted scope list. */
const fullResponse: TokenResponse = {
  accessToken: Redacted.make("access-token-2"),
  tokenType: "Bearer",
  expiresIn: Duration.hours(1),
  refreshToken: Option.some(Redacted.make("refresh-token-2")),
  scopes: Option.some(["user-modify-playback-state"]),
}

const account = { id: "spotify-user-2", displayName: "Someone" }

const noon = DateTime.makeUnsafe("2026-09-11T12:00:00Z")

const lifecycleLayer = ConnectionLifecycle.layer.pipe(
  Layer.provideMerge(ConnectionStore.layer),
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
  Layer.provide(Provider.layer("spotify")),
  Layer.provide(FakeProviders.layer),
  Layer.provide(FakeProviders.layerCredentials),
  Layer.provide(FakeRefreshAlarm.layer),
)

const withLifecycle = <A, E>(
  body: (
    lifecycle: ConnectionLifecycle["Service"],
    store: ConnectionStore["Service"],
  ) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(DateTime.toEpochMillis(noon))
    return yield* body(yield* ConnectionLifecycle, yield* ConnectionStore)
  }).pipe(Effect.provide(lifecycleLayer))

describe("ConnectionLifecycle", () => {
  it.effect("installs a full token response as an Authorized Connection", () =>
    withLifecycle((lifecycle, store) =>
      Effect.gen(function* () {
        yield* store.writeConnection(strugglingConnection)
        yield* lifecycle.accept(fullResponse, account)
        const connection = yield* store.readConnection
        assert.deepStrictEqual(
          connection,
          Option.some({
            accessToken: Redacted.make("access-token-2"),
            refreshToken: Option.some(Redacted.make("refresh-token-2")),
            scopes: ["user-modify-playback-state"],
            tokenType: "Bearer",
            expiresAt: DateTime.makeUnsafe("2026-09-11T13:00:00Z"),
            status: "Authorized",
            refreshRetryCount: 0,
            nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-11T12:55:00Z")),
            lastRefreshError: Option.none(),
            connectedAccount: account,
          }),
        )
      }),
    ),
  )

  it.effect("keeps the previous refresh token when the response omits one", () =>
    withLifecycle((lifecycle, store) =>
      Effect.gen(function* () {
        yield* store.writeConnection(authorizedConnection)
        const connection = yield* lifecycle.accept(
          { ...fullResponse, refreshToken: Option.none() },
          account,
        )
        assert.deepStrictEqual(
          connection.refreshToken,
          Option.some(Redacted.make("refresh-token-1")),
        )
        assert.strictEqual(connection.status, "Authorized")
      }),
    ),
  )

  it.effect("keeps the previous scopes when the response omits them", () =>
    withLifecycle((lifecycle, store) =>
      Effect.gen(function* () {
        yield* store.writeConnection(authorizedConnection)
        const connection = yield* lifecycle.accept(
          { ...fullResponse, scopes: Option.none() },
          account,
        )
        assert.deepStrictEqual(connection.scopes, [
          "user-read-currently-playing",
          "user-read-playback-state",
        ])
      }),
    ),
  )

  it.effect("becomes Reauthorization Required with no refresh token anywhere", () =>
    withLifecycle((lifecycle, store) =>
      Effect.gen(function* () {
        const connection = yield* lifecycle.accept(
          { ...fullResponse, refreshToken: Option.none() },
          account,
        )
        assert.strictEqual(connection.status, "Reauthorization Required")
        assert.deepStrictEqual(
          Option.map(yield* store.readConnection, (stored) => stored.status),
          Option.some("Reauthorization Required"),
        )
      }),
    ),
  )
})
