import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, given, message, model, story } from "foldkit/story"
import { describe, expect, test } from "vite-plus/test"
import { CopyOverlayUrl, FetchChannel, IssueOverlayKey, Message, update } from "../src/main.ts"
import { channel, loadedModel, now } from "./fixtures.ts"

const url = "https://stream.example/overlay/now-playing?key=abc"

const channelWithKey = {
  ...channel,
  overlayKey: Option.some({ issuedAt: DateTime.makeUnsafe(now) }),
}

const withKey = { ...loadedModel, channel: AsyncData.succeed(channelWithKey) }

describe("Overlay Key", () => {
  test("creating the first URL asks the API, shows the URL once, and refetches the Channel", () => {
    story(
      update,
      given(loadedModel),
      message(Message.ClickedIssueOverlayKey()),
      model((next) => expect(next.isOverlayKeyPending).toBe(true)),
      Command.expectExact(IssueOverlayKey),
      Command.resolve(IssueOverlayKey, Message.SucceededIssueOverlayKey({ url })),
      model((next) => {
        expect(next.isOverlayKeyPending).toBe(false)
        expect(next.maybeIssuedOverlayUrl).toEqual(Option.some({ url, maybeCopied: Option.none() }))
        expect(AsyncData.isRefreshing(next.channel)).toBe(true)
      }),
      Command.expectExact(FetchChannel),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel: channelWithKey, checkedAt: now + 500 }),
      ),
      message(Message.ClickedDismissOverlayUrl()),
      model((next) => expect(next.maybeIssuedOverlayUrl).toEqual(Option.none())),
    )
  })

  test("a second request while one is in flight is ignored", () => {
    story(
      update,
      given({ ...loadedModel, isOverlayKeyPending: true }),
      message(Message.ClickedIssueOverlayKey()),
      Command.expectNone(),
      message(Message.ClickedConfirmOverlayRotation()),
      Command.expectNone(),
    )
  })

  test("rotating waits for confirmation, and keeping the current URL asks for nothing", () => {
    story(
      update,
      given(withKey),
      message(Message.ClickedRotateOverlayKey()),
      model((next) => expect(next.isOverlayRotationPending).toBe(true)),
      Command.expectNone(),
      message(Message.ClickedKeepOverlayKey()),
      model((next) => expect(next.isOverlayRotationPending).toBe(false)),
      Command.expectNone(),
      message(Message.ClickedRotateOverlayKey()),
      message(Message.ClickedConfirmOverlayRotation()),
      model((next) => {
        expect(next.isOverlayRotationPending).toBe(false)
        expect(next.isOverlayKeyPending).toBe(true)
      }),
      Command.expectExact(IssueOverlayKey),
      Command.resolve(IssueOverlayKey, Message.SucceededIssueOverlayKey({ url })),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel: channelWithKey, checkedAt: now + 500 }),
      ),
    )
  })

  test("a refused request shows its message and fetches nothing", () => {
    story(
      update,
      given(withKey),
      message(Message.ClickedIssueOverlayKey()),
      Command.resolve(IssueOverlayKey, Message.FailedIssueOverlayKey({ message: "No answer." })),
      Command.expectNone(),
      model((next) => {
        expect(next.isOverlayKeyPending).toBe(false)
        expect(next.maybeOverlayError).toEqual(Option.some("No answer."))
        expect(next.maybeIssuedOverlayUrl).toEqual(Option.none())
      }),
      message(Message.ClickedRotateOverlayKey()),
      model((next) => expect(next.maybeOverlayError).toEqual(Option.none())),
    )
  })

  test("copying sends the shown URL to the clipboard and records the outcome", () => {
    story(
      update,
      given({
        ...withKey,
        maybeIssuedOverlayUrl: Option.some({ url, maybeCopied: Option.none() }),
      }),
      message(Message.ClickedCopyOverlayUrl()),
      Command.expectExact(CopyOverlayUrl({ url })),
      Command.resolve(CopyOverlayUrl, Message.CompletedCopyOverlayUrl({ isCopied: true })),
      model((next) =>
        expect(next.maybeIssuedOverlayUrl).toEqual(
          Option.some({ url, maybeCopied: Option.some(true) }),
        ),
      ),
    )
    story(update, given(withKey), message(Message.ClickedCopyOverlayUrl()), Command.expectNone())
  })
})
