import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as TestClock from "effect/testing/TestClock"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import {
  type AttemptClaim,
  type AttemptRejectionReason,
  ConnectionStore,
} from "../src/ConnectionStore.ts"
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

/** Consumes with the claim and reports why the store refused, failing the test if it did not. */
const rejectionOf = Effect.fnUntraced(function* (
  store: ConnectionStore["Service"],
  claim: AttemptClaim,
) {
  const rejection = yield* Effect.flip(store.consumeAttempt(claim))
  return rejection.reason
})

const expectRejection = (
  store: ConnectionStore["Service"],
  claim: AttemptClaim,
  reason: AttemptRejectionReason,
) => Effect.map(rejectionOf(store, claim), (actual) => assert.strictEqual(actual, reason))

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
        yield* store.consumeAttempt(claim)
        yield* expectRejection(store, claim, "Mismatch")
      }),
    ),
  )

  it.effect("refuses to consume an expired Attempt", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* pendingAttempt.expiresAt.pipe(DateTime.toEpochMillis, TestClock.setTime)
        yield* expectRejection(store, claim, "Expired")
      }),
    ),
  )

  it.effect("keeps working over a database created before the Broadcaster rename", () =>
    Effect.gen(function* () {
      yield* createLegacyAttemptTable
      const store = yield* Effect.provide(ConnectionStore, ConnectionStore.layer)
      yield* store.createAttempt(pendingAttempt)
      yield* store.consumeAttempt(claim)
    }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
  )

  it.effect("consumes an Attempt right before it expires", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* TestClock.setTime(DateTime.toEpochMillis(pendingAttempt.expiresAt) - 1)
        yield* store.consumeAttempt(claim)
      }),
    ),
  )

  const mismatches: ReadonlyArray<[string, Partial<typeof claim>, AttemptRejectionReason]> = [
    ["state", { state: "state-other" }, "Mismatch"],
    ["Provider", { provider: "twitch" }, "Mismatch"],
    [
      "callback URI",
      { callbackUri: "https://elsewhere.example/oauth/spotify/callback" },
      "Mismatch",
    ],
    [
      "Broadcaster user",
      { broadcaster: { ...claim.broadcaster, userUuid: "someone-else" } },
      "IdentityMismatch",
    ],
    [
      "Broadcaster email",
      { broadcaster: { ...claim.broadcaster, email: "someone@else.example" } },
      "IdentityMismatch",
    ],
  ]

  it.effect.each(mismatches)("refuses a claim with a different %s", ([, mismatch, reason]) =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* expectRejection(store, { ...claim, ...mismatch }, reason)
        yield* store.consumeAttempt(claim)
      }),
    ),
  )

  it.effect("reports a replay as a mismatch even under another identity", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* store.consumeAttempt(claim)
        yield* expectRejection(
          store,
          { ...claim, broadcaster: { ...claim.broadcaster, userUuid: "someone-else" } },
          "Mismatch",
        )
      }),
    ),
  )

  it.effect("reports an identity mismatch before an expiry", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.createAttempt(pendingAttempt)
        yield* pendingAttempt.expiresAt.pipe(DateTime.toEpochMillis, TestClock.setTime)
        yield* expectRejection(
          store,
          { ...claim, broadcaster: { ...claim.broadcaster, userUuid: "someone-else" } },
          "IdentityMismatch",
        )
      }),
    ),
  )
})
