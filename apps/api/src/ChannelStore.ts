import { ChannelState } from "@twitch-integrations/domain/ChannelState"
import { EventSubscription } from "@twitch-integrations/domain/EventSubscription"
import { HeldRedemption, Redemption } from "@twitch-integrations/domain/Redemption"
import { Reward } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
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
  /** Replaces the stored Event Subscription with the same ID; one not stored is left unstored. */
  readonly updateEventSubscription: (subscription: EventSubscription) => Effect.Effect<void>
  /** Whether a Notification with this message ID has been processed and not yet forgotten. */
  readonly hasSeenNotification: (messageId: string) => Effect.Effect<boolean>
  /** Remembers a processed Notification's message ID from the time it was received. */
  readonly recordNotification: (messageId: string, receivedAt: DateTime.Utc) => Effect.Effect<void>
  /** Forgets every Notification received before the cutoff. */
  readonly forgetNotificationsBefore: (cutoff: DateTime.Utc) => Effect.Effect<void>
  /** Appends a Redemption to the Processing Queue; one already queued keeps its place. */
  readonly enqueueRedemption: (redemption: Redemption) => Effect.Effect<void>
  /** The Redemption that has waited longest in the Processing Queue, or none while it is empty. */
  readonly nextRedemption: Effect.Effect<Option.Option<Redemption>>
  /** Takes the Redemption with the ID out of the Processing Queue. */
  readonly removeRedemption: (redemptionId: string) => Effect.Effect<void>
  /** Keeps a Redemption that could not be cancelled until a reconcile settles it; one already held keeps its place. */
  readonly holdRedemption: (held: HeldRedemption) => Effect.Effect<void>
  /** Every held Redemption, in the order they were held. */
  readonly readHeldRedemptions: Effect.Effect<ReadonlyArray<HeldRedemption>>
  /** Forgets the held Redemption with the ID once it has been settled. */
  readonly releaseRedemption: (redemptionId: string) => Effect.Effect<void>
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

/** Each queued Redemption is one JSON document in a row keyed by its Twitch ID, in arrival order. */
const RedemptionDocument = Schema.fromJsonString(Redemption).annotate({
  identifier: "RedemptionDocument",
})
const decodeRedemption = Schema.decodeEffect(RedemptionDocument)
const encodeRedemption = Schema.encodeEffect(RedemptionDocument)

/** Each held Redemption is one JSON document in a row keyed by its Twitch ID, in the order held. */
const HeldRedemptionDocument = Schema.fromJsonString(HeldRedemption).annotate({
  identifier: "HeldRedemptionDocument",
})
const decodeHeldRedemption = Schema.decodeEffect(HeldRedemptionDocument)
const encodeHeldRedemption = Schema.encodeEffect(HeldRedemptionDocument)

const decodeState = Schema.decodeUnknownEffect(ChannelState)

interface DocumentRow {
  readonly document: string
}

interface StateRow {
  readonly state: string
}

interface CountRow {
  readonly count: number
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
  yield* sql`
      CREATE TABLE IF NOT EXISTS seen_message (
        message_id TEXT PRIMARY KEY,
        received_at INTEGER NOT NULL
      )
    `
  yield* sql`
      CREATE TABLE IF NOT EXISTS redemption_queue (
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        redemption_id TEXT NOT NULL UNIQUE,
        document TEXT NOT NULL
      )
    `
  yield* sql`
      CREATE TABLE IF NOT EXISTS held_redemption (
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        redemption_id TEXT NOT NULL UNIQUE,
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

    updateEventSubscription: Effect.fn("ChannelStore.updateEventSubscription")(function* (
      subscription: EventSubscription,
    ) {
      const document = yield* encodeEventSubscription(subscription)
      yield* sql`
        UPDATE event_subscription SET document = ${document}
        WHERE subscription_id = ${subscription.id}
      `
    }, Effect.orDie),

    hasSeenNotification: (messageId) =>
      sql<CountRow>`SELECT COUNT(*) AS count FROM seen_message WHERE message_id = ${messageId}`.pipe(
        Effect.map((rows) => (rows[0]?.count ?? 0) > 0),
        Effect.orDie,
      ),

    recordNotification: (messageId, receivedAt) =>
      sql`
        INSERT INTO seen_message (message_id, received_at)
        VALUES (${messageId}, ${DateTime.toEpochMillis(receivedAt)})
        ON CONFLICT (message_id) DO NOTHING
      `.pipe(Effect.asVoid, Effect.orDie),

    forgetNotificationsBefore: (cutoff) =>
      sql`DELETE FROM seen_message WHERE received_at < ${DateTime.toEpochMillis(cutoff)}`.pipe(
        Effect.asVoid,
        Effect.orDie,
      ),

    enqueueRedemption: Effect.fn("ChannelStore.enqueueRedemption")(function* (
      redemption: Redemption,
    ) {
      const document = yield* encodeRedemption(redemption)
      yield* sql`
        INSERT INTO redemption_queue (redemption_id, document)
        VALUES (${redemption.id}, ${document})
        ON CONFLICT (redemption_id) DO NOTHING
      `
    }, Effect.orDie),

    nextRedemption: Effect.gen(function* () {
      const rows =
        yield* sql<DocumentRow>`SELECT document FROM redemption_queue ORDER BY position LIMIT 1`
      const row = rows[0]
      return row === undefined ? Option.none() : Option.some(yield* decodeRedemption(row.document))
    }).pipe(Effect.orDie),

    removeRedemption: (redemptionId) =>
      sql`DELETE FROM redemption_queue WHERE redemption_id = ${redemptionId}`.pipe(
        Effect.asVoid,
        Effect.orDie,
      ),

    holdRedemption: Effect.fn("ChannelStore.holdRedemption")(function* (held: HeldRedemption) {
      const document = yield* encodeHeldRedemption(held)
      yield* sql`
        INSERT INTO held_redemption (redemption_id, document)
        VALUES (${held.redemption.id}, ${document})
        ON CONFLICT (redemption_id) DO NOTHING
      `
    }, Effect.orDie),

    readHeldRedemptions: Effect.gen(function* () {
      const rows = yield* sql<DocumentRow>`SELECT document FROM held_redemption ORDER BY position`
      return yield* Effect.forEach(rows, (row) => decodeHeldRedemption(row.document))
    }).pipe(Effect.orDie),

    releaseRedemption: (redemptionId) =>
      sql`DELETE FROM held_redemption WHERE redemption_id = ${redemptionId}`.pipe(
        Effect.asVoid,
        Effect.orDie,
      ),
  }
  return store
})

/**
 * Persistence for the Channel: its Reward, its state, its Event
 * Subscriptions, the message IDs it has processed lately, its Processing
 * Queue, and the Redemptions it holds for the next reconcile, written against the generic `SqlClient` so the same code
 * runs over Durable Object storage in production and over an in-memory
 * database in tests. As in the Connection store, storage failures and
 * malformed rows are defects.
 */
export class ChannelStore extends Context.Service<ChannelStore, ChannelStoreService>()(
  "@twitch-integrations/api/ChannelStore",
) {
  static readonly layer: Layer.Layer<ChannelStore, never, SqlClient.SqlClient> = make.pipe(
    Effect.orDie,
    Layer.effect(ChannelStore),
  )
}
