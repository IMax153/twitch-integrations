import * as DoSqlite from "@effect/sql-sqlite-do/SqliteClient"
import {
  ChannelMonitoring,
  type ChannelMonitoringEncoded,
} from "@twitch-integrations/domain/ChannelMonitoring"
import {
  ChatCommand,
  type ChatCommandEncoded,
  ChatCommandDraft,
  type ChatCommandDraftEncoded,
  NewChatCommand,
  type NewChatCommandEncoded,
} from "@twitch-integrations/domain/ChatCommand"
import {
  type DuplicateChatCommand,
  InvalidChatCommandDraft,
  type UnknownChatCommand,
} from "@twitch-integrations/domain/ChatCommandErrors"
import { Notification, type NotificationEncoded } from "@twitch-integrations/domain/Notification"
import { hasSettings, songRequestSettings } from "@twitch-integrations/domain/Reward"
import { logFailure, observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type * as SqlClient from "effect/unstable/sql/SqlClient"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelReceive } from "./ChannelReceive.ts"
import { ChannelReconcile, type ReconcileError } from "./ChannelReconcile.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { ChatCommands } from "./ChatCommands.ts"
import { Connections } from "./Connections.ts"
import { EventSubTransport } from "./EventSubTransport.ts"
import { Helix } from "./Helix.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"
import { RedemptionQueue } from "./RedemptionQueue.ts"
import { RewardPause } from "./RewardPause.ts"
import { SongRequests } from "./SongRequests.ts"
import { Spotify } from "./Spotify.ts"
import { TwitchAccess } from "./TwitchAccess.ts"
import { TwitchAppToken } from "./TwitchAppToken.ts"

/**
 * The RPC surface the Channel object exposes. A type alias rather than an
 * interface so it satisfies Alchemy's RPC index signature, and every member
 * a method, as on the Connection object.
 */
export type ChannelObjectShape = {
  /** Encoded, bounded monitoring snapshot across the RPC boundary. */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly describe: () => Effect.Effect<ChannelMonitoringEncoded>
  /**
   * Brings the channel in line with the spec. Failures cross the boundary
   * as plain objects carrying their tag and fields.
   */
  // oxlint-disable-next-line effecttsgo/lazy-effect
  readonly reconcile: () => Effect.Effect<void, ReconcileError>
  /**
   * Acts on a notification the receiver verified, in its encoded form since
   * it arrives by structured clone, and returns once the change is durable.
   * A resend of a processed message, or a notification the Channel has no
   * use for, changes nothing.
   */
  readonly receive: (notification: NotificationEncoded) => Effect.Effect<void>
  /**
   * The Broadcaster's writes to the Chat Commands, each taking the encoded
   * body the page sent and answering with the encoded Chat Command as
   * stored. A body the schema refuses, a name already taken in any casing,
   * or a name not held are typed rejections, which cross the boundary as
   * plain objects carrying their tag and fields.
   */
  readonly createChatCommand: (
    draft: NewChatCommandEncoded,
  ) => Effect.Effect<ChatCommandEncoded, DuplicateChatCommand | InvalidChatCommandDraft>
  readonly updateChatCommand: (
    name: string,
    draft: ChatCommandDraftEncoded,
  ) => Effect.Effect<ChatCommandEncoded, UnknownChatCommand | InvalidChatCommandDraft>
  readonly deleteChatCommand: (name: string) => Effect.Effect<void, UnknownChatCommand>
}

const decodeNotification = Schema.decodeUnknownEffect(Notification)
const encodeMonitoring = Schema.encodeEffect(ChannelMonitoring)
// What was just stored always encodes, so a failure here is a defect.
const encodeChatCommand = (command: ChatCommand) =>
  Effect.orDie(Schema.encodeEffect(ChatCommand)(command))

/** A body the page sent that the schema refused, as the rejection the page can show. */
const invalidDraft = (issue: Schema.SchemaError) =>
  InvalidChatCommandDraft.make({ message: issue.message })
/**
 * A rejected Chat Command write is the Broadcaster's to see on the page, not
 * an operational failure, so only a defect is logged.
 */
const defectsObserved = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.tapDefect(self, logFailure)

const decodeNewChatCommand = (input: unknown) =>
  Schema.decodeUnknownEffect(NewChatCommand)(input).pipe(Effect.mapError(invalidDraft))
const decodeChatCommandDraft = (input: unknown) =>
  Schema.decodeUnknownEffect(ChatCommandDraft)(input).pipe(Effect.mapError(invalidDraft))

/**
 * The object's behavior over its services, independent of Durable Object
 * hosting. An object that starts with a stored Reward whose settings differ
 * from the spec's constants reconciles itself, so a change to the constants
 * reaches the channel without the Broadcaster reconnecting Twitch; one that
 * starts with Redemptions still queued goes on processing them.
 */
export const makeChannelObject: Effect.Effect<
  ChannelObjectShape,
  never,
  ChannelStore | ChannelReconcile | ChannelReceive | RedemptionQueue | ChatCommands
> = Effect.gen(function* () {
  const store = yield* ChannelStore
  const { reconcile } = yield* ChannelReconcile
  const { receive } = yield* ChannelReceive
  const queue = yield* RedemptionQueue
  const chatCommands = yield* ChatCommands
  const stored = yield* store.readReward
  if (Option.isSome(stored) && !hasSettings(stored.value, songRequestSettings)) {
    yield* Effect.logInfo("The stored Reward's settings differ from the spec; reconciling")
    yield* reconcile.pipe(observed, Effect.ignore)
  }
  yield* queue.kick
  return {
    describe: () => store.readMonitoring.pipe(Effect.flatMap(encodeMonitoring), Effect.orDie),
    reconcile: () => observed(reconcile),
    // The receiver only ever sends what it encoded from this schema, so a
    // notification that does not decode is a defect, not a failure to report.
    receive: (notification) =>
      decodeNotification(notification).pipe(Effect.orDie, Effect.flatMap(receive), observed),
    createChatCommand: (draft) =>
      decodeNewChatCommand(draft).pipe(
        Effect.flatMap(chatCommands.create),
        Effect.flatMap(encodeChatCommand),
        defectsObserved,
      ),
    updateChatCommand: (name, draft) =>
      decodeChatCommandDraft(draft).pipe(
        Effect.flatMap((decoded) => chatCommands.update(name, decoded)),
        Effect.flatMap(encodeChatCommand),
        defectsObserved,
      ),
    deleteChatCommand: (name) => defectsObserved(chatCommands.remove(name)),
  }
})

/**
 * The object's whole layer graph over a `SqlClient`, the Provider
 * Credentials, an `HttpClient`, the Worker's view of the Connection objects,
 * and the transport settings.
 */
export const channelObjectLayer: Layer.Layer<
  ChannelStore | ChannelReconcile | ChannelReceive | RedemptionQueue | ChatCommands,
  never,
  | SqlClient.SqlClient
  | ProviderCredentials
  | HttpClient.HttpClient
  | Connections
  | EventSubTransport
> = Layer.mergeAll(ChannelReconcile.layer, ChannelReceive.layer, ChatCommands.layer).pipe(
  Layer.provideMerge(RedemptionQueue.layer),
  Layer.provide(SongRequests.layer),
  Layer.provide(Layer.mergeAll(ChannelLock.layer, TwitchAccess.layer, RewardPause.layer)),
  Layer.provideMerge(
    Layer.mergeAll(ChannelStore.layer, Helix.layer, Spotify.layer, TwitchAppToken.layer),
  ),
)

/**
 * The one Channel object, addressed by a fixed name. The class is only the
 * object's identity, which the receiver imports to bind the namespace the
 * API Worker hosts; `layer` is the implementation, built by the API Worker
 * alone. The object hosts the Channel store over its own SQLite storage and
 * reaches the Connection objects over their namespace, the same way the
 * Worker does.
 */
export class ChannelObject extends Cloudflare.DurableObject<ChannelObject, ChannelObjectShape>()(
  "ChannelObject",
) {
  // Every service the init needs is one the hosting Worker provides.
  static readonly layer = ChannelObject.make<never>(
    Effect.gen(function* () {
      const state = yield* Cloudflare.DurableObjectState
      // The Connection objects' namespace is resolved here, in the init
      // Effect, which is the only place the hosting Worker's services are
      // available; the instance Effect below may need only the object's own.
      // The object's init is its entry point.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide
      const connections = yield* Effect.provide(Connections, Connections.layer)
      // Alchemy's constructor contract: the init Effect returns the Effect that
      // builds the instance, so the nested Effect here is intended.
      // oxlint-disable-next-line effecttsgo/return-effect-in-gen
      return observed(
        Effect.gen(function* () {
          // The store lives as long as this in-memory instance; its scope is
          // never closed on purpose, as on the Connection object.
          const instanceScope = yield* Scope.make()
          const services = yield* Layer.buildWithScope(
            channelObjectLayer.pipe(
              Layer.provide(DoSqlite.layer({ storage: state.raw.storage })),
              Layer.provide(ProviderCredentials.layer),
              Layer.provide(FetchHttpClient.layer),
              Layer.provide(Layer.succeed(Connections, connections)),
              Layer.provide(EventSubTransport.layer),
            ),
            instanceScope,
          )
          return yield* makeChannelObject.pipe(Effect.provide(services))
        }),
      )
    }),
  )
}
