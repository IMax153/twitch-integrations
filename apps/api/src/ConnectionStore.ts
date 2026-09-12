import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import { Connection } from "@twitch-integrations/domain/Connection"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SqlClient from "effect/unstable/sql/SqlClient"

/** What a callback must present to consume the Attempt it belongs to. */
export type AttemptClaim = Pick<
  AuthorizationAttempt,
  "state" | "provider" | "callbackUri" | "broadcaster"
>

/**
 * Why a claim consumed nothing. `Mismatch` covers everything the callback
 * cannot be told apart from a forgery: an unknown state value, an Attempt
 * already consumed, or a Provider or callback URI other than the one the
 * Attempt was started with.
 */
export type AttemptRejectionReason = "Expired" | "IdentityMismatch" | "Mismatch"

/** The callback presented a claim no pending, unexpired Attempt matches. */
export class AuthorizationAttemptRejected extends Data.TaggedError("AuthorizationAttemptRejected")<{
  readonly reason: AttemptRejectionReason
}> {}

export interface ConnectionStoreService {
  /** The stored Connection, or none when the Provider is Not Configured. */
  readonly readConnection: Effect.Effect<Option.Option<Connection>>
  /** Replaces the stored Connection entirely. */
  readonly writeConnection: (connection: Connection) => Effect.Effect<void>
  readonly createAttempt: (attempt: AuthorizationAttempt) => Effect.Effect<void>
  /**
   * Marks the matching Attempt consumed, or reports why none matched. A
   * second consume, an expired Attempt, or a claim whose Provider, callback
   * URI, or Broadcaster differs from the stored Attempt are all rejections.
   */
  readonly consumeAttempt: (
    claim: AttemptClaim,
  ) => Effect.Effect<void, AuthorizationAttemptRejected>
}

/** The Connection is one Schema-validated JSON document in a single-row table. */
const ConnectionDocument = Schema.fromJsonString(Connection).annotate({
  identifier: "ConnectionDocument",
})
const decodeDocument = Schema.decodeEffect(ConnectionDocument)
const encodeDocument = Schema.encodeEffect(ConnectionDocument)

interface ConnectionRow {
  readonly document: string
}

interface ConsumedRow {
  readonly state: string
}

/** What the store looks at to explain a claim that consumed nothing. */
interface AttemptRow {
  readonly provider: string
  readonly callback_uri: string
  readonly broadcaster_user_uuid: string
  readonly broadcaster_email: string
  readonly expires_at: number
  readonly consumed: number
}

/**
 * Why the claim did not match the Attempt stored under its state value, if
 * any. Checked in order of how much the callback may be told: a forged or
 * replayed claim learns nothing, a wrong Broadcaster learns that much, and
 * only a claim that is otherwise right learns the Attempt expired.
 */
const rejectionReason = (
  claim: AttemptClaim,
  row: AttemptRow | undefined,
  now: DateTime.DateTime,
): AttemptRejectionReason => {
  if (
    row === undefined ||
    row.consumed !== 0 ||
    row.provider !== claim.provider ||
    row.callback_uri !== claim.callbackUri
  ) {
    return "Mismatch"
  }
  if (
    row.broadcaster_user_uuid !== claim.broadcaster.userUuid ||
    row.broadcaster_email !== claim.broadcaster.email
  ) {
    return "IdentityMismatch"
  }
  return row.expires_at <= millis(now) ? "Expired" : "Mismatch"
}

/** Times are stored as epoch milliseconds so SQLite compares them as integers. */
const millis = DateTime.toEpochMillis

const createTables = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
  yield* sql`
      CREATE TABLE IF NOT EXISTS connection (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        document TEXT NOT NULL
      )
    `
  yield* sql`
      CREATE TABLE IF NOT EXISTS authorization_attempt (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        callback_uri TEXT NOT NULL,
        broadcaster_user_uuid TEXT NOT NULL,
        broadcaster_email TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed INTEGER NOT NULL DEFAULT 0
      )
    `
  yield* renameLegacyBroadcasterColumns(sql)
})

interface ColumnRow {
  readonly name: string
}

/**
 * A database created before Operator was renamed Broadcaster still carries
 * the old column names; rename them in place so its Attempts keep working.
 * Runs every time the store builds and is a no-op once renamed.
 */
const renameLegacyBroadcasterColumns = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
  const columns = yield* sql<ColumnRow>`SELECT name FROM pragma_table_info('authorization_attempt')`
  if (columns.some((column) => column.name === "operator_user_uuid")) {
    yield* sql`ALTER TABLE authorization_attempt RENAME COLUMN operator_user_uuid TO broadcaster_user_uuid`
    yield* sql`ALTER TABLE authorization_attempt RENAME COLUMN operator_email TO broadcaster_email`
  }
})

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* createTables(sql)

  const store: ConnectionStoreService = {
    readConnection: Effect.gen(function* () {
      const rows = yield* sql<ConnectionRow>`SELECT document FROM connection WHERE id = 1`
      const row = rows[0]
      if (row === undefined) {
        return Option.none()
      }
      // NOTE: the parse error is dropped on purpose: it would print the stored
      // document, tokens included, into the logs.
      const connection = yield* decodeDocument(row.document).pipe(
        Effect.catch(() => Effect.die("The stored Connection document no longer decodes")),
      )
      return Option.some(connection)
    }).pipe(Effect.orDie),

    writeConnection: Effect.fn("ConnectionStore.writeConnection")(function* (
      connection: Connection,
    ) {
      const document = yield* encodeDocument(connection)
      yield* sql`
        INSERT INTO connection (id, document) VALUES (1, ${document})
        ON CONFLICT (id) DO UPDATE SET document = excluded.document
      `
    }, Effect.orDie),

    createAttempt: (attempt) =>
      sql`
        INSERT INTO authorization_attempt ${sql.insert({
          state: attempt.state,
          provider: attempt.provider,
          callback_uri: attempt.callbackUri,
          broadcaster_user_uuid: attempt.broadcaster.userUuid,
          broadcaster_email: attempt.broadcaster.email,
          created_at: millis(attempt.createdAt),
          expires_at: millis(attempt.expiresAt),
          consumed: attempt.consumed ? 1 : 0,
        })}
      `.pipe(Effect.asVoid, Effect.orDie),

    // NOTE: one conditional UPDATE, so a concurrent second callback cannot
    // consume the same Attempt: SQLite runs the statement atomically and only
    // the first matches the unconsumed row. The SELECT that explains a miss
    // runs after, so a claim that lost such a race reads the row as consumed.
    consumeAttempt: Effect.fn("ConnectionStore.consumeAttempt")(
      function* (claim: AttemptClaim) {
        const now = yield* DateTime.now
        const consumed = yield* sql<ConsumedRow>`
          UPDATE authorization_attempt SET consumed = 1
          WHERE state = ${claim.state}
            AND provider = ${claim.provider}
            AND callback_uri = ${claim.callbackUri}
            AND broadcaster_user_uuid = ${claim.broadcaster.userUuid}
            AND broadcaster_email = ${claim.broadcaster.email}
            AND consumed = 0
            AND expires_at > ${millis(now)}
          RETURNING state
        `
        if (consumed.length > 0) {
          return
        }
        const rows = yield* sql<AttemptRow>`
          SELECT provider, callback_uri, broadcaster_user_uuid, broadcaster_email, expires_at, consumed
          FROM authorization_attempt WHERE state = ${claim.state}
        `
        return yield* new AuthorizationAttemptRejected({
          reason: rejectionReason(claim, rows[0], now),
        })
      },
      Effect.catchTag("SqlError", Effect.die),
    ),
  }
  return store
})

/**
 * Persistence for one Provider's Connection and Authorization Attempts,
 * written against the generic `SqlClient` so the same code runs over Durable
 * Object storage in production and over an in-memory database in tests.
 *
 * Storage failures and malformed rows are defects: nothing above the store
 * can recover from a broken database, and a row that no longer decodes is
 * corruption rather than a condition to handle.
 */
export class ConnectionStore extends Context.Service<ConnectionStore, ConnectionStoreService>()(
  "@twitch-integrations/api/ConnectionStore",
) {
  static readonly layer: Layer.Layer<ConnectionStore, never, SqlClient.SqlClient> = make.pipe(
    Effect.orDie,
    Layer.effect(ConnectionStore),
  )
}
