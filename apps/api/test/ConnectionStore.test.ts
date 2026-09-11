import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as TestClock from "effect/testing/TestClock"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import { type AttemptClaim, ConnectionStore } from "../src/ConnectionStore.ts"
import { authorizedConnection, pendingAttempt } from "./fixtures.ts"

/** The claim a callback for this Attempt would present. */
const claimOf = ({
  state,
  provider,
  callbackUri,
  broadcaster,
}: AuthorizationAttempt): AttemptClaim => ({
  state,
  provider,
  callbackUri,
  broadcaster,
})

const claim = claimOf(pendingAttempt)

/** A fresh in-memory database per test, running the real store over it. */
const storeLayer = ConnectionStore.layer.pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
)

const withStore = <A, E>(body: (store: ConnectionStore["Service"]) => Effect.Effect<A, E>) =>
  Effect.flatMap(ConnectionStore, body).pipe(Effect.provide(storeLayer))

/** The Attempt table as the store created it before Operator was renamed Broadcaster. */
const createLegacyAttemptTable = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    CREATE TABLE authorization_attempt (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      callback_uri TEXT NOT NULL,
      operator_user_uuid TEXT NOT NULL,
      operator_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0
    )
  `,
)

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

  it.effect("keeps working over a database created before the Broadcaster rename", () =>
    Effect.gen(function* () {
      yield* createLegacyAttemptTable
      const store = yield* Effect.provide(ConnectionStore, ConnectionStore.layer)
      yield* store.createAttempt(pendingAttempt)
      assert.isTrue(yield* store.consumeAttempt(claim))
    }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
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
    ["Broadcaster user", { broadcaster: { ...claim.broadcaster, userUuid: "someone-else" } }],
    ["Broadcaster email", { broadcaster: { ...claim.broadcaster, email: "someone@else.example" } }],
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
