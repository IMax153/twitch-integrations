import {
  type ChatCommand,
  ChatCommandResponse,
  Cooldown,
  maximumCooldown,
} from "@twitch-integrations/domain/ChatCommand"
import * as Array from "effect/Array"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { AsyncData, Update, type Runtime } from "foldkit"
import { evo } from "foldkit/struct"
import {
  CopyOverlayUrl,
  CreateChatCommand,
  DeleteChatCommand,
  FetchChannel,
  FetchConnections,
  IssueOverlayKey,
  UpdateChatCommand,
} from "./command.ts"
import { Message } from "./message.ts"
import {
  type ChatCommandWriteOrigin,
  type Flags,
  type Model,
  emptyNewChatCommand,
  refreshIntervalMs,
} from "./model.ts"

export { Flags, Model } from "./model.ts"
export { Message } from "./message.ts"
export {
  CopyOverlayUrl,
  CreateChatCommand,
  DeleteChatCommand,
  FetchChannel,
  FetchConnections,
  IssueOverlayKey,
  UpdateChatCommand,
} from "./command.ts"
export { view } from "./view.ts"

type UpdateReturn = Update.Return<Model, Message>

export const init: Runtime.ApplicationInit<Model, Message, Flags> = (flags) => ({
  model: {
    connections: flags.isVisible ? AsyncData.Loading() : AsyncData.Idle(),
    channel: flags.isVisible ? AsyncData.Loading() : AsyncData.Idle(),
    maybeResult: flags.maybeResult,
    maybeConnectionsCheckedAt: Option.none(),
    maybeChannelCheckedAt: Option.none(),
    now: flags.now,
    lastRefreshStartedAt: flags.now,
    isVisible: flags.isVisible,
    isQueueOpen: false,
    isHeldOpen: false,
    isReadinessOpen: false,
    expandedProviders: [],
    newChatCommand: emptyNewChatCommand,
    maybeChatCommandEdit: Option.none(),
    maybePendingDeletion: Option.none(),
    maybePendingWrite: Option.none(),
    maybeChatCommandError: Option.none(),
    isOverlayRotationPending: false,
    isOverlayKeyPending: false,
    maybeIssuedOverlayUrl: Option.none(),
    maybeOverlayError: Option.none(),
  },
  commands: flags.isVisible ? [FetchConnections(), FetchChannel()] : Array.empty(),
})

const refreshConnections = (model: Model): UpdateReturn =>
  Option.match(AsyncData.revalidateOrLoad(model.connections), {
    onNone: () => ({ model }),
    onSome: (connections) => ({
      model: evo(model, { connections: () => connections }),
      commands: [FetchConnections()],
    }),
  })

const refreshChannel = (model: Model): UpdateReturn =>
  Option.match(AsyncData.revalidateOrLoad(model.channel), {
    onNone: () => ({ model }),
    onSome: (channel) => ({
      model: evo(model, { channel: () => channel }),
      commands: [FetchChannel()],
    }),
  })

const refresh = (model: Model): UpdateReturn =>
  Update.combine(evo(model, { lastRefreshStartedAt: () => model.now }), [
    refreshConnections,
    refreshChannel,
  ])

/**
 * Reads the Channel again right after a write, even while a scheduled
 * refresh is in flight: that one may have read the Channel before the write
 * landed, and the later answer settles last.
 */
const refetchChannel = (model: Model): UpdateReturn => ({
  model: evo(model, {
    channel: (current) => Option.getOrElse(AsyncData.revalidateOrLoad(current), () => current),
  }),
  commands: [FetchChannel()],
})

const tick =
  (model: Model) =>
  ({ now }: typeof Message.TickedClock.Type): UpdateReturn => {
    const next = evo(model, { now: () => now })
    return next.isVisible && now - next.lastRefreshStartedAt >= refreshIntervalMs
      ? refresh(next)
      : { model: next }
  }

const updateVisibility =
  (model: Model) =>
  ({ isVisible, now }: typeof Message.UpdatedVisibility.Type): UpdateReturn => {
    const next = evo(model, { isVisible: () => isVisible, now: () => now })
    return isVisible && !model.isVisible ? refresh(next) : { model: next }
  }

/** The Chat Command the snapshot holds under this name, if the snapshot is loaded and has one. */
const storedChatCommand = (model: Model, name: string): Option.Option<ChatCommand> =>
  Option.flatMap(AsyncData.getData(model.channel), (channel) =>
    Array.findFirst(channel.chatCommands, (command) => command.name === name),
  )

const maximumCooldownSeconds = Duration.toSeconds(maximumCooldown)
const cooldownWording = `Cooldown must be a whole number of seconds from 0 to ${maximumCooldownSeconds}.`
const parseCooldownMillis = Schema.decodeUnknownOption(Cooldown)

/** The Cooldown a row's seconds field names, decoded through the domain's bounds, or the wording to show when it names none. */
const parseCooldown = (seconds: string): Result.Result<Duration.Duration, string> => {
  const value = Number(seconds.trim())
  const cooldown =
    seconds.trim() !== "" && Number.isInteger(value)
      ? parseCooldownMillis(value * 1000)
      : Option.none<Duration.Duration>()
  return Option.match(cooldown, {
    onNone: () => Result.fail(cooldownWording),
    onSome: Result.succeed,
  })
}

const responseWording = "Response must be 1 to 500 characters."
const parseResponse = Schema.decodeUnknownOption(ChatCommandResponse)

/**
 * Starts a write from the add form or from the row named, clearing any
 * earlier refusal; the write's answer ends it. While one is in flight the
 * section's controls are disabled, so a second request is ignored.
 */
const startWrite = (
  model: Model,
  origin: ChatCommandWriteOrigin,
  commands: NonNullable<UpdateReturn["commands"]>,
): UpdateReturn =>
  Option.isSome(model.maybePendingWrite)
    ? { model }
    : {
        model: evo(model, {
          maybePendingWrite: () => Option.some(origin),
          maybeChatCommandError: () => Option.none(),
        }),
        commands,
      }

const refuseLocally = (
  model: Model,
  origin: ChatCommandWriteOrigin,
  message: string,
): UpdateReturn => ({
  model: evo(model, {
    maybeChatCommandError: () => Option.some({ maybeName: origin.maybeName, message }),
  }),
})

const fromAddForm: ChatCommandWriteOrigin = { maybeName: Option.none() }
const fromRow = (name: string): ChatCommandWriteOrigin => ({ maybeName: Option.some(name) })

const submitNewChatCommand = (model: Model): UpdateReturn =>
  startWrite(model, fromAddForm, [
    CreateChatCommand({
      name: model.newChatCommand.name.trim(),
      response: model.newChatCommand.response,
    }),
  ])

const submitChatCommandEdit = (model: Model): UpdateReturn =>
  Option.match(model.maybeChatCommandEdit, {
    onNone: () => ({ model }),
    onSome: (edit) => {
      const origin = fromRow(edit.name)
      const stored = storedChatCommand(model, edit.name)
      if (Option.isNone(stored)) {
        return refuseLocally(
          model,
          origin,
          "This Chat Command is no longer on the Channel. Refresh and try again.",
        )
      }
      const response = parseResponse(edit.response)
      if (Option.isNone(response)) {
        return refuseLocally(model, origin, responseWording)
      }
      return Result.match(parseCooldown(edit.cooldownSeconds), {
        onFailure: (message) => refuseLocally(model, origin, message),
        onSuccess: (cooldown) =>
          startWrite(model, origin, [
            UpdateChatCommand({
              name: edit.name,
              draft: { response: response.value, cooldown, status: stored.value.status },
            }),
          ]),
      })
    },
  })

const requestChatCommandStatus =
  (model: Model) =>
  ({ name, status }: typeof Message.ClickedChatCommandStatus.Type): UpdateReturn =>
    Option.match(storedChatCommand(model, name), {
      onNone: () => ({ model }),
      onSome: (stored) =>
        startWrite(model, fromRow(name), [
          UpdateChatCommand({
            name,
            draft: { response: stored.response, cooldown: stored.cooldown, status },
          }),
        ]),
    })

const confirmChatCommandDeletion = (model: Model): UpdateReturn =>
  Option.match(model.maybePendingDeletion, {
    onNone: () => ({ model }),
    onSome: (name) => startWrite(model, fromRow(name), [DeleteChatCommand({ name })]),
  })

/**
 * A write landed: what it came from closes (the add form empties only when
 * the write was its own, so a draft typed there survives a row's save) and
 * the Channel is read again.
 */
const completeWrite = (model: Model): UpdateReturn =>
  refetchChannel(
    evo(model, {
      maybePendingWrite: () => Option.none(),
      newChatCommand: (form) =>
        Option.exists(model.maybePendingWrite, (write) => Option.isNone(write.maybeName))
          ? emptyNewChatCommand
          : form,
      maybeChatCommandEdit: () => Option.none(),
      maybePendingDeletion: () => Option.none(),
    }),
  )

/**
 * A refused write is shown where it came from: by the row it was for, or by
 * the add form. What was typed stays so it can be corrected.
 */
const refuseWrite =
  (model: Model) =>
  ({ message }: typeof Message.FailedChatCommandWrite.Type): UpdateReturn => ({
    model: evo(model, {
      maybePendingWrite: () => Option.none(),
      maybeChatCommandError: () =>
        Option.some({
          maybeName: Option.flatMap(model.maybePendingWrite, (write) => write.maybeName),
          message,
        }),
    }),
  })

/**
 * Asks for an Overlay Key, whether the first or a rotation: the confirmation
 * closes, any earlier refusal clears, and the section waits for the answer.
 * A second request while one is in flight is ignored.
 */
const issueOverlayKey = (model: Model): UpdateReturn =>
  model.isOverlayKeyPending
    ? { model }
    : {
        model: evo(model, {
          isOverlayKeyPending: () => true,
          isOverlayRotationPending: () => false,
          maybeOverlayError: () => Option.none(),
          maybeIssuedOverlayUrl: () => Option.none(),
        }),
        commands: [IssueOverlayKey()],
      }

const copyOverlayUrl = (model: Model): UpdateReturn =>
  Option.match(model.maybeIssuedOverlayUrl, {
    onNone: () => ({ model }),
    onSome: (issued) => ({ model, commands: [CopyOverlayUrl({ url: issued.url })] }),
  })

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededFetchConnections: ({ connections, checkedAt }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.succeed(connections)),
        maybeConnectionsCheckedAt: () => Option.some(checkedAt),
        now: () => Math.max(model.now, checkedAt),
      }),
    }),
    FailedFetchConnections: ({ error }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.fail(error)),
      }),
    }),
    SucceededFetchChannel: ({ channel, checkedAt }) => ({
      model: evo(model, {
        channel: (current) => AsyncData.settle(current, Result.succeed(channel)),
        maybeChannelCheckedAt: () => Option.some(checkedAt),
        now: () => Math.max(model.now, checkedAt),
      }),
    }),
    FailedFetchChannel: ({ error }) => ({
      model: evo(model, { channel: (current) => AsyncData.settle(current, Result.fail(error)) }),
    }),
    ClickedReload: () => refresh(model),
    TickedClock: tick(model),
    UpdatedVisibility: updateVisibility(model),
    ToggledQueue: ({ isOpen }) => ({ model: evo(model, { isQueueOpen: () => isOpen }) }),
    ToggledHeld: ({ isOpen }) => ({ model: evo(model, { isHeldOpen: () => isOpen }) }),
    ToggledReadiness: ({ isOpen }) => ({ model: evo(model, { isReadinessOpen: () => isOpen }) }),
    ToggledConnection: ({ provider, isOpen }) => ({
      model: evo(model, {
        expandedProviders: (current) =>
          isOpen
            ? Array.dedupe([...current, provider])
            : Array.filter(current, (value) => value !== provider),
      }),
    }),
    UpdatedNewChatCommandName: ({ value }) => ({
      model: evo(model, { newChatCommand: (form) => evo(form, { name: () => value }) }),
    }),
    UpdatedNewChatCommandResponse: ({ value }) => ({
      model: evo(model, { newChatCommand: (form) => evo(form, { response: () => value }) }),
    }),
    SubmittedNewChatCommand: () => submitNewChatCommand(model),
    ClickedEditChatCommand: ({ name }) => ({
      model: evo(model, {
        maybeChatCommandEdit: () =>
          Option.map(storedChatCommand(model, name), (stored) => ({
            name,
            response: stored.response,
            cooldownSeconds: String(Duration.toSeconds(stored.cooldown)),
          })),
        maybePendingDeletion: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    UpdatedChatCommandResponse: ({ value }) => ({
      model: evo(model, {
        maybeChatCommandEdit: Option.map((edit) => evo(edit, { response: () => value })),
      }),
    }),
    UpdatedChatCommandCooldown: ({ value }) => ({
      model: evo(model, {
        maybeChatCommandEdit: Option.map((edit) => evo(edit, { cooldownSeconds: () => value })),
      }),
    }),
    ClickedCancelChatCommandEdit: () => ({
      model: evo(model, {
        maybeChatCommandEdit: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    SubmittedChatCommandEdit: () => submitChatCommandEdit(model),
    ClickedChatCommandStatus: requestChatCommandStatus(model),
    ClickedDeleteChatCommand: ({ name }) => ({
      model: evo(model, {
        maybePendingDeletion: () => Option.some(name),
        maybeChatCommandEdit: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    ClickedKeepChatCommand: () => ({
      model: evo(model, {
        maybePendingDeletion: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    ClickedConfirmChatCommandDeletion: () => confirmChatCommandDeletion(model),
    SucceededChatCommandWrite: () => completeWrite(model),
    FailedChatCommandWrite: refuseWrite(model),
    ClickedIssueOverlayKey: () => issueOverlayKey(model),
    ClickedRotateOverlayKey: () => ({
      model: evo(model, {
        isOverlayRotationPending: () => true,
        maybeOverlayError: () => Option.none(),
      }),
    }),
    ClickedKeepOverlayKey: () => ({ model: evo(model, { isOverlayRotationPending: () => false }) }),
    ClickedConfirmOverlayRotation: () => issueOverlayKey(model),
    // The snapshot is read again so the issue time it shows is the new one.
    SucceededIssueOverlayKey: ({ url }) =>
      refetchChannel(
        evo(model, {
          isOverlayKeyPending: () => false,
          maybeIssuedOverlayUrl: () => Option.some({ url, maybeCopied: Option.none() }),
        }),
      ),
    FailedIssueOverlayKey: ({ message }) => ({
      model: evo(model, {
        isOverlayKeyPending: () => false,
        maybeOverlayError: () => Option.some(message),
      }),
    }),
    ClickedCopyOverlayUrl: () => copyOverlayUrl(model),
    CompletedCopyOverlayUrl: ({ isCopied }) => ({
      model: evo(model, {
        maybeIssuedOverlayUrl: Option.map((issued) =>
          evo(issued, { maybeCopied: () => Option.some(isCopied) }),
        ),
      }),
    }),
    ClickedDismissOverlayUrl: () => ({
      model: evo(model, { maybeIssuedOverlayUrl: () => Option.none() }),
    }),
  })
