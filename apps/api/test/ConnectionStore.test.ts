import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as TestClock from "effect/testing/TestClock"
import { ConnectionStore } from "../src/ConnectionStore.ts"
import { authorizedConnection, pendingAttempt } from "./fixtures.ts"

const claim = {
  state: pendingAttempt.state,
  provider: pendingAttempt.provider,
  callbackUri: pendingAttempt.callbackUri,
  operator: pendingAttempt.operator,
}

/** A fresh in-memory database per test, running the real store over it. */
const storeLayer = ConnectionStore.layer.pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
)

const withStore = <A, E>(body: (store: ConnectionStore["Service"]) => Effect.Effect<A, E>) =>
  Effect.flatMap(ConnectionStore, body).pipe(Effect.provide(storeLayer))

describe("ConnectionStore", () => {
  it.effect("reads no Connection from an empty store", () =>
    withStore((store) =>
      Effect.gen(function* () {
        const connection = yield* store.readConnection
        assert.deepStrictEqual(connection, Option.none())
      }),
    ),
  )

  it.effect("reads back the Connection it wrote", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.writeConnection(authorizedConnection)
        const connection = yield* store.readConnection
        assert.deepStrictEqual(connection, Option.some(authorizedConnection))
      }),
    ),
  )

  it.effect("consumes a pending Attempt once", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        assert.isTrue(yield* store.consumeAttempt(claim))
        assert.isFalse(yield* store.consumeAttempt(claim))
      }),
    ),
  )

  it.effect("refuses to consume an expired Attempt", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* TestClock.setTime(DateTime.toEpochMillis(pendingAttempt.expiresAt))
        assert.isFalse(yield* store.consumeAttempt(claim))
      }),
    ),
  )

  it.effect("consumes an Attempt right before it expires", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* TestClock.setTime(DateTime.toEpochMillis(pendingAttempt.expiresAt) - 1)
        assert.isTrue(yield* store.consumeAttempt(claim))
      }),
    ),
  )

  const mismatches: ReadonlyArray<[string, Partial<typeof claim>]> = [
    ["state", { state: "state-other" }],
    ["Provider", { provider: "twitch" }],
    ["callback URI", { callbackUri: "https://elsewhere.example/oauth/spotify/callback" }],
    ["Operator user", { operator: { ...claim.operator, userUuid: "someone-else" } }],
    ["Operator email", { operator: { ...claim.operator, email: "someone@else.example" } }],
  ]

  it.effect.each(mismatches)("refuses a claim with a different %s", ([, mismatch]) =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        assert.isFalse(yield* store.consumeAttempt({ ...claim, ...mismatch }))
        assert.isTrue(yield* store.consumeAttempt(claim))
      }),
    ),
  )
})
