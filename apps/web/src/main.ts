import {
  type ChatCommand,
  ChatCommandResponse,
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
  CreateChatCommand,
  DeleteChatCommand,
  FetchChannel,
  FetchConnections,
  UpdateChatCommand,
} from "./command.ts"
import { Message } from "./message.ts"
import { type Flags, type Model, emptyNewChatCommand, refreshIntervalMs } from "./model.ts"

export { Flags, Model } from "./model.ts"
export { Message } from "./message.ts"
export {
  CreateChatCommand,
  DeleteChatCommand,
  FetchChannel,
  FetchConnections,
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
    isWritingChatCommand: false,
    maybeChatCommandError: Option.none(),
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

const cooldownWording = "Cooldown must be a whole number of seconds from 0 to 3600."

/** The Cooldown a row's seconds field names, or the wording to show when it names none. */
const parseCooldown = (seconds: string): Result.Result<Duration.Duration, string> => {
  const value = Number(seconds.trim())
  return seconds.trim() !== "" && Number.isInteger(value) && value >= 0
    ? Result.succeed(Duration.seconds(value)).pipe(
        Result.filterOrFail(
          (cooldown) => Duration.isLessThanOrEqualTo(cooldown, maximumCooldown),
          () => cooldownWording,
        ),
      )
    : Result.fail(cooldownWording)
}

/** Marks a write as under way and clears any earlier refusal; the write's answer ends it. */
const startWrite = (
  model: Model,
  commands: NonNullable<UpdateReturn["commands"]>,
): UpdateReturn => ({
  model: evo(model, {
    isWritingChatCommand: () => true,
    maybeChatCommandError: () => Option.none(),
  }),
  commands,
})

const refuseLocally = (
  model: Model,
  maybeName: Option.Option<string>,
  message: string,
): UpdateReturn => ({
  model: evo(model, { maybeChatCommandError: () => Option.some({ maybeName, message }) }),
})

const responseWording = "Response must be 1 to 500 characters."
const parseResponse = Schema.decodeUnknownOption(ChatCommandResponse)

const submitNewChatCommand = (model: Model): UpdateReturn =>
  model.isWritingChatCommand
    ? { model }
    : startWrite(model, [
        CreateChatCommand({
          name: model.newChatCommand.name.trim(),
          response: model.newChatCommand.response,
        }),
      ])

const submitChatCommandEdit = (model: Model): UpdateReturn =>
  Option.match(model.maybeChatCommandEdit, {
    onNone: () => ({ model }),
    onSome: (edit) => {
      if (model.isWritingChatCommand) {
        return { model }
      }
      const stored = storedChatCommand(model, edit.name)
      if (Option.isNone(stored)) {
        return refuseLocally(
          model,
          Option.some(edit.name),
          "This Chat Command is no longer in the snapshot. Refresh and try again.",
        )
      }
      const response = parseResponse(edit.response)
      if (Option.isNone(response)) {
        return refuseLocally(model, Option.some(edit.name), responseWording)
      }
      return Result.match(parseCooldown(edit.cooldownSeconds), {
        onFailure: (message) => refuseLocally(model, Option.some(edit.name), message),
        onSuccess: (cooldown) =>
          startWrite(model, [
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
  ({ name, status }: typeof Message.RequestedChatCommandStatus.Type): UpdateReturn =>
    Option.match(storedChatCommand(model, name), {
      onNone: () => ({ model }),
      onSome: (stored) =>
        model.isWritingChatCommand
          ? { model }
          : startWrite(model, [
              UpdateChatCommand({
                name,
                draft: { response: stored.response, cooldown: stored.cooldown, status },
              }),
            ]),
    })

const confirmChatCommandDeletion = (model: Model): UpdateReturn =>
  Option.match(model.maybePendingDeletion, {
    onNone: () => ({ model }),
    onSome: (name) =>
      model.isWritingChatCommand ? { model } : startWrite(model, [DeleteChatCommand({ name })]),
  })

/** A write landed: the form, row, and confirmation it came from close, and the snapshot is read again. */
const settleWrite = (model: Model): UpdateReturn =>
  refetchChannel(
    evo(model, {
      isWritingChatCommand: () => false,
      newChatCommand: () => emptyNewChatCommand,
      maybeChatCommandEdit: () => Option.none(),
      maybePendingDeletion: () => Option.none(),
    }),
  )

/**
 * A refused write is shown where it came from: by the row being edited or
 * deleted, or by the add form. What was typed stays so it can be corrected.
 */
const refuseWrite =
  (model: Model) =>
  ({ message }: typeof Message.FailedChatCommandWrite.Type): UpdateReturn => ({
    model: evo(model, {
      isWritingChatCommand: () => false,
      maybeChatCommandError: () =>
        Option.some({
          maybeName: Option.orElse(
            Option.map(model.maybeChatCommandEdit, (edit) => edit.name),
            () => model.maybePendingDeletion,
          ),
          message,
        }),
    }),
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
    ChangedNewChatCommandName: ({ value }) => ({
      model: evo(model, { newChatCommand: (form) => evo(form, { name: () => value }) }),
    }),
    ChangedNewChatCommandResponse: ({ value }) => ({
      model: evo(model, { newChatCommand: (form) => evo(form, { response: () => value }) }),
    }),
    SubmittedNewChatCommand: () => submitNewChatCommand(model),
    StartedEditingChatCommand: ({ name }) => ({
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
    ChangedChatCommandResponse: ({ value }) => ({
      model: evo(model, {
        maybeChatCommandEdit: Option.map((edit) => evo(edit, { response: () => value })),
      }),
    }),
    ChangedChatCommandCooldown: ({ value }) => ({
      model: evo(model, {
        maybeChatCommandEdit: Option.map((edit) => evo(edit, { cooldownSeconds: () => value })),
      }),
    }),
    CancelledEditingChatCommand: () => ({
      model: evo(model, {
        maybeChatCommandEdit: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    SubmittedChatCommandEdit: () => submitChatCommandEdit(model),
    RequestedChatCommandStatus: requestChatCommandStatus(model),
    RequestedChatCommandDeletion: ({ name }) => ({
      model: evo(model, {
        maybePendingDeletion: () => Option.some(name),
        maybeChatCommandEdit: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    CancelledChatCommandDeletion: () => ({
      model: evo(model, {
        maybePendingDeletion: () => Option.none(),
        maybeChatCommandError: () => Option.none(),
      }),
    }),
    ConfirmedChatCommandDeletion: () => confirmChatCommandDeletion(model),
    SucceededChatCommandWrite: () => settleWrite(model),
    FailedChatCommandWrite: refuseWrite(model),
  })
