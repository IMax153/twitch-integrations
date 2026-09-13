import { ChatCommandResponse } from "@twitch-integrations/domain/ChatCommand"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AsyncData } from "foldkit"
import { Command, given, message, model, story } from "foldkit/story"
import { describe, expect, test } from "vite-plus/test"
import {
  CreateChatCommand,
  DeleteChatCommand,
  FetchChannel,
  Message,
  UpdateChatCommand,
  update,
} from "../src/main.ts"
import { channel, channelWithToday, loadedModel, now, today } from "./fixtures.ts"

const response = Schema.decodeSync(ChatCommandResponse)

/** The snapshot as read back after a write. */
const refetched = Message.SucceededFetchChannel({ channel: channelWithToday, checkedAt: now + 500 })

const withToday = { ...loadedModel, channel: AsyncData.succeed(channelWithToday) }

describe("Chat Command writes", () => {
  test("creating a Chat Command sends the draft, clears the form, and refetches the Channel at once", () => {
    story(
      update,
      given(loadedModel),
      message(Message.UpdatedNewChatCommandName({ value: "today" })),
      message(Message.UpdatedNewChatCommandResponse({ value: today.response })),
      message(Message.SubmittedNewChatCommand()),
      model((next) => expect(Option.isSome(next.maybePendingWrite)).toBe(true)),
      Command.expectExact(CreateChatCommand({ name: "today", response: today.response })),
      Command.resolve(CreateChatCommand, Message.SucceededChatCommandWrite()),
      model((next) => {
        expect(next.maybePendingWrite).toEqual(Option.none())
        expect(next.newChatCommand).toEqual({ name: "", response: "" })
        expect(AsyncData.isRefreshing(next.channel)).toBe(true)
      }),
      Command.expectExact(FetchChannel),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel: channelWithToday, checkedAt: now + 500 }),
      ),
      model((next) => {
        expect(AsyncData.getData(next.channel)).toEqual(Option.some(channelWithToday))
      }),
    )
  })

  test("a rejected create shows its message by the form, keeps the draft, and fetches nothing", () => {
    story(
      update,
      given(loadedModel),
      message(Message.UpdatedNewChatCommandName({ value: "Today" })),
      message(Message.UpdatedNewChatCommandResponse({ value: "two" })),
      message(Message.SubmittedNewChatCommand()),
      Command.resolve(
        CreateChatCommand,
        Message.FailedChatCommandWrite({ message: "A Chat Command named Today already exists." }),
      ),
      Command.expectNone(),
      model((next) => {
        expect(next.maybePendingWrite).toEqual(Option.none())
        expect(next.newChatCommand).toEqual({ name: "Today", response: "two" })
        expect(next.maybeChatCommandError).toEqual(
          Option.some({
            maybeName: Option.none(),
            message: "A Chat Command named Today already exists.",
          }),
        )
      }),
    )
  })

  test("editing a row starts from the stored values and sends the whole draft", () => {
    story(
      update,
      given(withToday),
      message(Message.ClickedEditChatCommand({ name: "today" })),
      model((next) => {
        expect(next.maybeChatCommandEdit).toEqual(
          Option.some({ name: "today", response: today.response, cooldownSeconds: "10" }),
        )
      }),
      message(Message.UpdatedChatCommandResponse({ value: "new" })),
      message(Message.UpdatedChatCommandCooldown({ value: "30" })),
      message(Message.SubmittedChatCommandEdit()),
      Command.expectExact(
        UpdateChatCommand({
          name: "today",
          draft: { response: response("new"), cooldown: Duration.seconds(30), status: "Enabled" },
        }),
      ),
      Command.resolve(UpdateChatCommand, Message.SucceededChatCommandWrite()),
      model((next) => expect(next.maybeChatCommandEdit).toEqual(Option.none())),
      Command.resolve(FetchChannel, refetched),
    )
  })

  test("a Cooldown that is not a whole number of seconds from 0 to 3600 is refused before sending", () => {
    story(
      update,
      given(withToday),
      message(Message.ClickedEditChatCommand({ name: "today" })),
      message(Message.UpdatedChatCommandCooldown({ value: "3601" })),
      message(Message.SubmittedChatCommandEdit()),
      Command.expectNone(),
      model((next) => {
        expect(Option.map(next.maybeChatCommandError, (error) => error.maybeName)).toEqual(
          Option.some(Option.some("today")),
        )
        expect(Option.isSome(next.maybeChatCommandEdit)).toBe(true)
      }),
      message(Message.ClickedCancelChatCommandEdit()),
      model((next) => {
        expect(next.maybeChatCommandEdit).toEqual(Option.none())
        expect(next.maybeChatCommandError).toEqual(Option.none())
      }),
    )
  })

  test("disabling sends the stored response and Cooldown with the new status", () => {
    story(
      update,
      given(withToday),
      message(Message.ClickedChatCommandStatus({ name: "today", status: "Disabled" })),
      Command.expectExact(
        UpdateChatCommand({
          name: "today",
          draft: { response: today.response, cooldown: today.cooldown, status: "Disabled" },
        }),
      ),
      Command.resolve(UpdateChatCommand, Message.SucceededChatCommandWrite()),
      Command.resolve(FetchChannel, refetched),
    )
  })

  test("deleting asks first, and only a confirmation sends the request", () => {
    story(
      update,
      given(withToday),
      message(Message.ClickedDeleteChatCommand({ name: "today" })),
      Command.expectNone(),
      model((next) => expect(next.maybePendingDeletion).toEqual(Option.some("today"))),
      message(Message.ClickedKeepChatCommand()),
      Command.expectNone(),
      model((next) => expect(next.maybePendingDeletion).toEqual(Option.none())),
      message(Message.ClickedDeleteChatCommand({ name: "today" })),
      message(Message.ClickedConfirmChatCommandDeletion()),
      Command.expectExact(DeleteChatCommand({ name: "today" })),
      Command.resolve(DeleteChatCommand, Message.SucceededChatCommandWrite()),
      model((next) => expect(next.maybePendingDeletion).toEqual(Option.none())),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 500 }),
      ),
      model((next) => {
        expect(Option.map(AsyncData.getData(next.channel), (data) => data.chatCommands)).toEqual(
          Option.some([]),
        )
      }),
    )
  })

  test("a save refetches even while a scheduled refresh is in flight", () => {
    story(
      update,
      given({ ...withToday, channel: AsyncData.Refreshing({ data: channelWithToday }) }),
      message(Message.ClickedChatCommandStatus({ name: "today", status: "Disabled" })),
      Command.resolve(UpdateChatCommand, Message.SucceededChatCommandWrite()),
      Command.expectExact(FetchChannel),
      Command.resolve(FetchChannel, refetched),
    )
  })

  test("a refused Disable is shown by its row, not by the add form", () => {
    story(
      update,
      given(withToday),
      message(Message.ClickedChatCommandStatus({ name: "today", status: "Disabled" })),
      Command.resolve(
        UpdateChatCommand,
        Message.FailedChatCommandWrite({ message: "No Chat Command is named today." }),
      ),
      Command.expectNone(),
      model((next) => {
        expect(next.maybeChatCommandError).toEqual(
          Option.some({
            maybeName: Option.some("today"),
            message: "No Chat Command is named today.",
          }),
        )
      }),
    )
  })

  test("a row's save leaves a draft typed in the add form alone", () => {
    story(
      update,
      given(withToday),
      message(Message.UpdatedNewChatCommandName({ value: "soon" })),
      message(Message.ClickedChatCommandStatus({ name: "today", status: "Disabled" })),
      Command.resolve(UpdateChatCommand, Message.SucceededChatCommandWrite()),
      Command.resolve(FetchChannel, refetched),
      model((next) => expect(next.newChatCommand).toEqual({ name: "soon", response: "" })),
    )
  })
})
