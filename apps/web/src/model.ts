import { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Schema from "effect/Schema"
import { AsyncData } from "foldkit"

export const refreshIntervalMs = 10_000
export const staleAfterMs = 30_000
export const requestTimeoutMs = 8_000

export const Connections = Schema.Array(ConnectionSummary).annotate({ identifier: "Connections" })
const ConnectionsAsyncData = AsyncData.Schema(Connections, Schema.String)
const ChannelAsyncData = AsyncData.Schema(ChannelMonitoring, Schema.String)

/** The add form's fields as typed, unvalidated until sent. */
export const NewChatCommandForm = Schema.Struct({
  name: Schema.String,
  response: Schema.String,
}).annotate({ identifier: "NewChatCommandForm" })
export type NewChatCommandForm = typeof NewChatCommandForm.Type

export const emptyNewChatCommand: NewChatCommandForm = { name: "", response: "" }

/** One row being edited in place: the Cooldown is typed in seconds. */
export const ChatCommandEdit = Schema.Struct({
  name: Schema.String,
  response: Schema.String,
  cooldownSeconds: Schema.String,
}).annotate({ identifier: "ChatCommandEdit" })
export type ChatCommandEdit = typeof ChatCommandEdit.Type

/** A refused write, shown next to the row it came from, or next to the add form when no name is set. */
export const ChatCommandError = Schema.Struct({
  maybeName: Schema.Option(Schema.String),
  message: Schema.String,
}).annotate({ identifier: "ChatCommandError" })
export type ChatCommandError = typeof ChatCommandError.Type

export const Flags = Schema.Struct({
  maybeResult: Schema.Option(BroadcasterResult),
  now: Schema.Finite,
  isVisible: Schema.Boolean,
}).annotate({ identifier: "Flags" })
export type Flags = typeof Flags.Type

export const Model = Schema.Struct({
  connections: ConnectionsAsyncData.schema,
  channel: ChannelAsyncData.schema,
  maybeResult: Schema.Option(BroadcasterResult),
  maybeConnectionsCheckedAt: Schema.Option(Schema.Finite),
  maybeChannelCheckedAt: Schema.Option(Schema.Finite),
  now: Schema.Finite,
  lastRefreshStartedAt: Schema.Finite,
  isVisible: Schema.Boolean,
  isQueueOpen: Schema.Boolean,
  isHeldOpen: Schema.Boolean,
  isReadinessOpen: Schema.Boolean,
  expandedProviders: Schema.Array(ProviderName),
  newChatCommand: NewChatCommandForm,
  maybeChatCommandEdit: Schema.Option(ChatCommandEdit),
  /** The name of the Chat Command whose deletion awaits confirmation. */
  maybePendingDeletion: Schema.Option(Schema.String),
  /** One Chat Command write at a time: the section's controls wait for it. */
  isWritingChatCommand: Schema.Boolean,
  maybeChatCommandError: Schema.Option(ChatCommandError),
}).annotate({ identifier: "Model" })
export type Model = typeof Model.Type
