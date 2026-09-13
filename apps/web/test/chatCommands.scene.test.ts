import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, click, expect, given, role, scene, selector, text } from "foldkit/scene"
import { describe, test } from "vite-plus/test"
import { DeleteChatCommand, FetchChannel, Message, update, view } from "../src/main.ts"
import {
  authorizedTwitch,
  channel,
  channelWithToday,
  chatReadyTwitch,
  loadedModel,
  now,
  today,
} from "./fixtures.ts"

const withToday = { ...loadedModel, channel: AsyncData.succeed(channelWithToday) }

describe("Chat Commands section", () => {
  test("lists each Chat Command with its name, response, status, Cooldown, and when it last answered", () => {
    scene(
      { update, view },
      given(withToday),
      expect(role("heading", { name: "Chat Commands" })).toExist(),
      expect(text("!today")).toExist(),
      expect(text(today.response)).toExist(),
      expect(selector('.chat-command[data-status="Enabled"]')).toExist(),
      expect(text("Cooldown 10s")).toExist(),
      expect(text("Last answered 2m 0s ago")).toExist(),
      expect(role("button", { name: "Edit !today" })).toExist(),
      expect(role("button", { name: "Disable !today" })).toExist(),
      expect(role("button", { name: "Delete !today" })).toExist(),
    )
  })

  test("says when there are no Chat Commands and still offers the add form", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(text("No Chat Commands yet.")).toExist(),
      expect(role("button", { name: "Add Chat Command" })).toExist(),
      expect(selector(".chat-command")).not.toExist(),
    )
  })

  test("shows the scope notice only for an Authorized Twitch Connection that lacks a chat scope", () => {
    scene(
      { update, view },
      given({ ...withToday, connections: AsyncData.succeed([authorizedTwitch]) }),
      expect(selector(".scope-notice")).toExist(),
      expect(selector(".scope-notice")).toContainText("user:bot"),
      expect(selector(".scope-notice")).toContainText("channel:bot"),
      expect(selector(".scope-notice")).not.toContainText("user:read:chat"),
      expect(selector(".scope-notice")).toContainText("Reconnect"),
    )
    scene(
      { update, view },
      given({ ...withToday, connections: AsyncData.succeed([chatReadyTwitch]) }),
      expect(selector(".scope-notice")).not.toExist(),
    )
    scene({ update, view }, given(withToday), expect(selector(".scope-notice")).not.toExist())
    scene(
      { update, view },
      given({
        ...withToday,
        connections: AsyncData.succeed([
          { ...authorizedTwitch, status: "Reauthorization Required" },
        ]),
      }),
      expect(selector(".scope-notice")).not.toExist(),
    )
  })

  test("edits in place and cancels back to the row", () => {
    scene(
      { update, view },
      given(withToday),
      click(role("button", { name: "Edit !today" })),
      expect(role("button", { name: "Save !today" })).toExist(),
      expect(selector("textarea#chat-command-today-response")).toHaveValue(today.response),
      expect(selector("input#chat-command-today-cooldown")).toHaveValue("10"),
      click(role("button", { name: "Cancel editing !today" })),
      expect(role("button", { name: "Save !today" })).not.toExist(),
      expect(role("button", { name: "Edit !today" })).toExist(),
    )
  })

  test("deletes only after an inline confirmation", () => {
    scene(
      { update, view },
      given(withToday),
      click(role("button", { name: "Delete !today" })),
      expect(text("Delete !today?")).toExist(),
      click(role("button", { name: "Keep !today" })),
      expect(text("Delete !today?")).not.toExist(),
      click(role("button", { name: "Delete !today" })),
      click(role("button", { name: "Confirm deleting !today" })),
      Command.resolve(DeleteChatCommand, Message.SucceededChatCommandWrite()),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 500 }),
      ),
      expect(text("No Chat Commands yet.")).toExist(),
    )
  })

  test("shows a refused write next to the form it came from", () => {
    scene(
      { update, view },
      given({
        ...withToday,
        maybeChatCommandError: Option.some({
          maybeName: Option.none(),
          message: "A Chat Command named Today already exists.",
        }),
      }),
      expect(selector(".chat-command-add .error-text")).toHaveText(
        "A Chat Command named Today already exists.",
      ),
    )
    scene(
      { update, view },
      given({
        ...withToday,
        maybeChatCommandError: Option.some({
          maybeName: Option.some("today"),
          message: "Cooldown must be a whole number of seconds from 0 to 3600.",
        }),
      }),
      expect(selector(".chat-command .error-text")).toHaveText(
        "Cooldown must be a whole number of seconds from 0 to 3600.",
      ),
    )
  })
})
