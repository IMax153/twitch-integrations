import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, click, expect, given, role, scene, selector, text } from "foldkit/scene"
import { describe, test } from "vite-plus/test"
import { FetchChannel, IssueOverlayKey, Message, update, view } from "../src/main.ts"
import { channel, loadedModel, now } from "./fixtures.ts"

const url = "https://stream.example/overlay/now-playing?key=abc"

const channelWithKey = {
  ...channel,
  overlayKey: Option.some({ issuedAt: DateTime.makeUnsafe(now - 120_000) }),
}

const withKey = { ...loadedModel, channel: AsyncData.succeed(channelWithKey) }

describe("Overlay section", () => {
  test("offers to create the first URL, then shows it once with copy and dismiss", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(role("heading", { name: "Overlay" })).toExist(),
      expect(text("No Overlay URL yet")).toExist(),
      expect(role("button", { name: "Rotate Overlay URL" })).not.toExist(),
      click(role("button", { name: "Create Overlay URL" })),
      expect(role("button", { name: "Create Overlay URL" })).toBeDisabled(),
      Command.resolve(IssueOverlayKey, Message.SucceededIssueOverlayKey({ url })),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel: channelWithKey, checkedAt: now + 500 }),
      ),
      expect(selector("#overlay-url")).toHaveValue(url),
      expect(selector(".overlay-once")).toContainText("This URL is shown once."),
      expect(role("button", { name: "Copy URL" })).toExist(),
      click(role("button", { name: "Done, hide it" })),
      expect(selector("#overlay-url")).not.toExist(),
    )
  })

  test("shows when the key was issued and asks before rotating it", () => {
    scene(
      { update, view },
      given(withKey),
      expect(text("Overlay URL issued")).toExist(),
      expect(selector(".overlay-issued-at")).toContainText("Issued 2m 0s ago."),
      click(role("button", { name: "Rotate Overlay URL" })),
      expect(text("Rotate the Overlay URL?")).toExist(),
      expect(role("button", { name: "Rotate" })).toExist(),
      click(role("button", { name: "Keep the current URL" })),
      expect(text("Rotate the Overlay URL?")).not.toExist(),
      expect(role("button", { name: "Rotate Overlay URL" })).toExist(),
    )
  })

  test("shows a refusal as an alert by the section", () => {
    scene(
      { update, view },
      given({ ...withKey, maybeOverlayError: Option.some("No answer.") }),
      expect(role("alert")).toHaveText("No answer."),
    )
  })
})
