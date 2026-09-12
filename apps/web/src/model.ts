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
}).annotate({ identifier: "Model" })
export type Model = typeof Model.Type
