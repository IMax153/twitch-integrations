import { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import { ChatCommandStatus } from "@twitch-integrations/domain/ChatCommand"
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
  ChangedNewChatCommandName: { value: Schema.String },
  ChangedNewChatCommandResponse: { value: Schema.String },
  SubmittedNewChatCommand: {},
  StartedEditingChatCommand: { name: Schema.String },
  ChangedChatCommandResponse: { value: Schema.String },
  ChangedChatCommandCooldown: { value: Schema.String },
  CancelledEditingChatCommand: {},
  SubmittedChatCommandEdit: {},
  RequestedChatCommandStatus: { name: Schema.String, status: ChatCommandStatus },
  RequestedChatCommandDeletion: { name: Schema.String },
  CancelledChatCommandDeletion: {},
  ConfirmedChatCommandDeletion: {},
  SucceededChatCommandWrite: {},
  FailedChatCommandWrite: { message: Schema.String },
})
export type Message = typeof Message.Type
