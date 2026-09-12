import { ChannelState } from "@twitch-integrations/domain/ChannelState"
import { EventSubscription } from "@twitch-integrations/domain/EventSubscription"
import { Reward } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SqlClient from "effect/unstable/sql/SqlClient"

export interface ChannelStoreService {
  /** The Reward the deployment owns, or none while it has not created or adopted one. */
  readonly readReward: Effect.Effect<Option.Option<Reward>>
  /** Replaces the stored Reward entirely. */
  readonly writeReward: (reward: Reward) => Effect.Effect<void>
  /** The Channel's state as last stored; Offline until something stores Live. */
  readonly readState: Effect.Effect<ChannelState>
  readonly writeState: (state: ChannelState) => Effect.Effect<void>
  /** Every stored Event Subscription, in the order they were stored. */
  readonly readEventSubscriptions: Effect.Effect<ReadonlyArray<EventSubscription>>
  /** Replaces every stored Event Subscription with the given ones, atomically. */
  readonly replaceEventSubscriptions: (
    subscriptions: ReadonlyArray<EventSubscription>,
  ) => Effect.Effect<void>
}

/**
 * The Reward is one Schema-validated JSON document in a single-row table.
 * Unlike the Connection document it holds no token, so a parse error may
 * surface as it is.
 */
const RewardDocument = Schema.fromJsonString(Reward).annotate({ identifier: "RewardDocument" })
const decodeReward = Schema.decodeEffect(RewardDocument)
const encodeReward = Schema.encodeEffect(RewardDocument)

/** Each Event Subscription is one JSON document in a row keyed by its Twitch ID. */
const EventSubscriptionDocument = Schema.fromJsonString(EventSubscription).annotate({
  identifier: "EventSubscriptionDocument",
})
const decodeEventSubscription = Schema.decodeEffect(EventSubscriptionDocument)
const encodeEventSubscription = Schema.encodeEffect(EventSubscriptionDocument)

const decodeState = Schema.decodeUnknownEffect(ChannelState)

interface DocumentRow {
  readonly document: string
}

interface StateRow {
  readonly state: string
}

const createTables = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
  yield* sql`
      CREATE TABLE IF NOT EXISTS reward (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        document TEXT NOT NULL
      )
    `
  yield* sql`
      CREATE TABLE IF NOT EXISTS channel_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL
      )
    `
  yield* sql`
      CREATE TABLE IF NOT EXISTS event_subscription (
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id TEXT NOT NULL UNIQUE,
        document TEXT NOT NULL
      )
    `
})

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* createTables(sql)

  const store: ChannelStoreService = {
    readReward: Effect.gen(function* () {
      const rows = yield* sql<DocumentRow>`SELECT document FROM reward WHERE id = 1`
      const row = rows[0]
      return row === undefined ? Option.none() : Option.some(yield* decodeReward(row.document))
    }).pipe(Effect.orDie),

    writeReward: Effect.fn("ChannelStore.writeReward")(function* (reward: Reward) {
      const document = yield* encodeReward(reward)
      yield* sql`
        INSERT INTO reward (id, document) VALUES (1, ${document})
        ON CONFLICT (id) DO UPDATE SET document = excluded.document
      `
    }, Effect.orDie),

    readState: Effect.gen(function* () {
      const rows = yield* sql<StateRow>`SELECT state FROM channel_state WHERE id = 1`
      const row = rows[0]
      return row === undefined ? "Offline" : yield* decodeState(row.state)
    }).pipe(Effect.orDie),

    writeState: (state) =>
      sql`
        INSERT INTO channel_state (id, state) VALUES (1, ${state})
        ON CONFLICT (id) DO UPDATE SET state = excluded.state
      `.pipe(Effect.asVoid, Effect.orDie),

    readEventSubscriptions: Effect.gen(function* () {
      const rows =
        yield* sql<DocumentRow>`SELECT document FROM event_subscription ORDER BY position`
      return yield* Effect.forEach(rows, (row) => decodeEventSubscription(row.document))
    }).pipe(Effect.orDie),

    replaceEventSubscriptions: Effect.fn("ChannelStore.replaceEventSubscriptions")(
      function* (subscriptions: ReadonlyArray<EventSubscription>) {
        const documents = yield* Effect.forEach(subscriptions, (subscription) =>
          Effect.map(encodeEventSubscription(subscription), (document) => ({
            subscription_id: subscription.id,
            document,
          })),
        )
        yield* sql`DELETE FROM event_subscription`
        if (documents.length > 0) {
          yield* sql`INSERT INTO event_subscription ${sql.insert(documents)}`
        }
      },
      sql.withTransaction,
      Effect.orDie,
    ),
  }
  return store
})

/**
 * Persistence for the Channel: its Reward, its state, and its Event
 * Subscriptions, written against the generic `SqlClient` so the same code
 * runs over Durable Object storage in production and over an in-memory
 * database in tests. As in the Connection store, storage failures and
 * malformed rows are defects.
 */
export class ChannelStore extends Context.Service<ChannelStore, ChannelStoreService>()(
  "@twitch-integrations/api/ChannelStore",
) {
  static readonly layer: Layer.Layer<ChannelStore, never, SqlClient.SqlClient> = Layer.effect(
    ChannelStore,
  )(Effect.orDie(make))
}
