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
  UpdatedNewChatCommandName: { value: Schema.String },
  UpdatedNewChatCommandResponse: { value: Schema.String },
  SubmittedNewChatCommand: {},
  ClickedEditChatCommand: { name: Schema.String },
  UpdatedChatCommandResponse: { value: Schema.String },
  UpdatedChatCommandCooldown: { value: Schema.String },
  ClickedCancelChatCommandEdit: {},
  SubmittedChatCommandEdit: {},
  ClickedChatCommandStatus: { name: Schema.String, status: ChatCommandStatus },
  ClickedDeleteChatCommand: { name: Schema.String },
  ClickedKeepChatCommand: {},
  ClickedConfirmChatCommandDeletion: {},
  SucceededChatCommandWrite: {},
  FailedChatCommandWrite: { message: Schema.String },
  ClickedIssueOverlayKey: {},
  ClickedRotateOverlayKey: {},
  ClickedKeepOverlayKey: {},
  ClickedConfirmOverlayRotation: {},
  SucceededIssueOverlayKey: { url: Schema.String },
  FailedIssueOverlayKey: { message: Schema.String },
  ClickedCopyOverlayUrl: {},
  CompletedCopyOverlayUrl: { isCopied: Schema.Boolean },
  ClickedDismissOverlayUrl: {},
})
export type Message = typeof Message.Type
