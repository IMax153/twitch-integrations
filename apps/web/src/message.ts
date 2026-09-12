import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Schema from "effect/Schema"
import { defineMessageUnion } from "foldkit/message"
import { Connections } from "./model.ts"

export const Message = defineMessageUnion({
  SucceededFetchConnections: { connections: Connections, checkedAt: Schema.Finite },
  FailedFetchConnections: { error: Schema.String },
  SucceededFetchChannel: { channel: ChannelMonitoring, checkedAt: Schema.Finite },
  FailedFetchChannel: { error: Schema.String },
  ClickedReload: {},
  TickedClock: { now: Schema.Finite },
  UpdatedVisibility: { isVisible: Schema.Boolean, now: Schema.Finite },
  ToggledQueue: { isOpen: Schema.Boolean },
  ToggledHeld: { isOpen: Schema.Boolean },
  ToggledReadiness: { isOpen: Schema.Boolean },
  ToggledConnection: { provider: ProviderName, isOpen: Schema.Boolean },
})
export type Message = typeof Message.Type
