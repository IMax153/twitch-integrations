import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import { Connection } from "@twitch-integrations/domain/Connection"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SqlClient from "effect/unstable/sql/SqlClient"

/** What a callback must present to consume the Attempt it belongs to. */
export type AttemptClaim = Pick<
  AuthorizationAttempt,
  "state" | "provider" | "callbackUri" | "operator"
>

export interface ConnectionStoreService {
  /** The stored Connection, or none when the Provider is Not Configured. */
  readonly readConnection: Effect.Effect<Option.Option<Connection>>
  /** Replaces the stored Connection entirely. */
  readonly writeConnection: (connection: Connection) => Effect.Effect<void>
  readonly createAttempt: (attempt: AuthorizationAttempt) => Effect.Effect<void>
  /**
   * Marks the matching Attempt consumed and reports whether one was. A second
   * consume, an expired Attempt, or a claim whose Provider, callback URI, or
   * Operator differs from the stored Attempt all report false.
   */
  readonly consumeAttempt: (claim: AttemptClaim) => Effect.Effect<boolean>
}

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
  static readonly layer: Layer.Layer<ConnectionStore, never, SqlClient.SqlClient> = Layer.effect(
    ConnectionStore,
  )(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      yield* createTables(sql)
      return make(sql)
    }).pipe(Effect.orDie),
  )
}

/** The Connection is one Schema-validated JSON document in a single-row table. */
const ConnectionDocument = Schema.fromJsonString(Connection).annotate({
  identifier: "ConnectionDocument",
})
// NOTE: a parse failure is reported without the parse error itself, which
// would otherwise print the stored document, tokens included, into the logs.
const decodeDocument = (document: string) =>
  Schema.decodeEffect(ConnectionDocument)(document).pipe(
    Effect.catch(() => Effect.die("The stored Connection document no longer decodes")),
  )
const encodeDocument = Schema.encodeEffect(ConnectionDocument)

interface ConnectionRow {
  readonly document: string
}

interface ConsumedRow {
  readonly state: string
}

/** Times are stored as epoch milliseconds so SQLite compares them as integers. */
const millis = DateTime.toEpochMillis

const createTables = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
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
        operator_user_uuid TEXT NOT NULL,
        operator_email TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed INTEGER NOT NULL DEFAULT 0
      )
    `
  })

const make = (sql: SqlClient.SqlClient): ConnectionStoreService => ({
  readConnection: Effect.gen(function* () {
    const rows = yield* sql<ConnectionRow>`SELECT document FROM connection WHERE id = 1`
    const row = rows[0]
    return row === undefined ? Option.none() : Option.some(yield* decodeDocument(row.document))
  }).pipe(Effect.orDie),

  writeConnection: (connection) =>
    Effect.gen(function* () {
      const document = yield* encodeDocument(connection)
      yield* sql`
        INSERT INTO connection (id, document) VALUES (1, ${document})
        ON CONFLICT (id) DO UPDATE SET document = excluded.document
      `
    }).pipe(Effect.orDie),

  createAttempt: (attempt) =>
    sql`
      INSERT INTO authorization_attempt ${sql.insert({
        state: attempt.state,
        provider: attempt.provider,
        callback_uri: attempt.callbackUri,
        operator_user_uuid: attempt.operator.userUuid,
        operator_email: attempt.operator.email,
        created_at: millis(attempt.createdAt),
        expires_at: millis(attempt.expiresAt),
        consumed: attempt.consumed ? 1 : 0,
      })}
    `.pipe(Effect.asVoid, Effect.orDie),

  // NOTE: one conditional UPDATE, so a concurrent second callback cannot
  // consume the same Attempt: SQLite runs the statement atomically and only
  // the first matches the unconsumed row.
  consumeAttempt: (claim) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now
      const consumed = yield* sql<ConsumedRow>`
        UPDATE authorization_attempt SET consumed = 1
        WHERE state = ${claim.state}
          AND provider = ${claim.provider}
          AND callback_uri = ${claim.callbackUri}
          AND operator_user_uuid = ${claim.operator.userUuid}
          AND operator_email = ${claim.operator.email}
          AND consumed = 0
          AND expires_at > ${millis(now)}
        RETURNING state
      `
      return consumed.length > 0
    }).pipe(Effect.orDie),
})
