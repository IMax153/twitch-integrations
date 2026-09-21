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

/** Where a Chat Command write came from: the row named, or the add form when no name is set. */
export const ChatCommandWriteOrigin = Schema.Struct({
  maybeName: Schema.Option(Schema.String),
}).annotate({ identifier: "ChatCommandWriteOrigin" })
export type ChatCommandWriteOrigin = typeof ChatCommandWriteOrigin.Type

/** A refused write, shown next to the row it came from, or next to the add form when no name is set. */
export const ChatCommandError = Schema.Struct({
  maybeName: Schema.Option(Schema.String),
  message: Schema.String,
}).annotate({ identifier: "ChatCommandError" })
export type ChatCommandError = typeof ChatCommandError.Type

/**
 * The Overlay URL as just issued, shown once: the page keeps it only until
 * the Broadcaster dismisses it, and nothing else ever shows it again.
 */
export const IssuedOverlayUrl = Schema.Struct({
  url: Schema.String,
  /** Whether the last copy to the clipboard succeeded, once one was tried. */
  maybeCopied: Schema.Option(Schema.Boolean),
}).annotate({ identifier: "IssuedOverlayUrl" })
export type IssuedOverlayUrl = typeof IssuedOverlayUrl.Type

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
  /** The one Chat Command write in flight, if any: the section's controls wait for it. */
  maybePendingWrite: Schema.Option(ChatCommandWriteOrigin),
  maybeChatCommandError: Schema.Option(ChatCommandError),
  /** Whether rotating the Overlay Key awaits confirmation: it breaks the browser source OBS holds. */
  isOverlayRotationPending: Schema.Boolean,
  /** Whether an Overlay Key request is in flight; the section's buttons wait for it. */
  isOverlayKeyPending: Schema.Boolean,
  maybeIssuedOverlayUrl: Schema.Option(IssuedOverlayUrl),
  maybeOverlayError: Schema.Option(Schema.String),
}).annotate({ identifier: "Model" })
export type Model = typeof Model.Type
