import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, click, expect, given, role, scene, selector, text } from "foldkit/scene"
import { describe, test } from "vite-plus/test"
import { FetchChannel, FetchConnections, Message, update, view } from "../src/main.ts"
import {
  authorizedConnections,
  authorizedTwitch,
  channel,
  loadedModel,
  now,
  notConfiguredConnections as connections,
  strugglingTwitch,
} from "./fixtures.ts"

describe("Broadcaster Page", () => {
  test("shows all monitoring areas together with Provider-specific authorization forms", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(role("heading", { name: "Song Requests" })).toExist(),
      expect(role("heading", { name: "Processing" })).toExist(),
      expect(role("heading", { name: "Connections" })).toExist(),
      expect(role("button", { name: "Connect Spotify" })).toExist(),
      expect(role("button", { name: "Connect Twitch" })).toExist(),
      expect(selector('form[method="post"][action="/oauth/spotify/authorize"] button')).toHaveText(
        "Connect",
      ),
      expect(selector('form[method="post"][action="/oauth/twitch/authorize"] button')).toHaveText(
        "Connect",
      ),
    )
  })

  test("keeps account and authorization visible while technical details are collapsed", () => {
    scene(
      { update, view },
      given({ ...loadedModel, connections: AsyncData.succeed([authorizedTwitch]) }),
      expect(text("twitchdev")).toExist(),
      expect(role("button", { name: "Reconnect Twitch" })).toExist(),
      expect(selector('article[data-provider="twitch"] details[open]')).not.toExist(),
      expect(text("user:read:chat")).toExist(),
      expect(text("user:write:chat")).toExist(),
      expect(text("2026-09-11T13:00:00.000Z")).toExist(),
      expect(text("2026-09-11T12:55:00.000Z")).toExist(),
    )
  })

  test("shows refresh failures without requiring the Broadcaster to open details", () => {
    scene(
      { update, view },
      given({ ...loadedModel, connections: AsyncData.succeed([strugglingTwitch]) }),
      expect(
        text(
          "Last refresh error at 2026-09-11T12:55:00.000Z: The Twitch refresh request got no answer.",
        ),
      ).toExist(),
      expect(text("2026-09-11T12:56:00.000Z")).toExist(),
    )
  })

  test("shows no token dates or account details while Not Configured", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(selector("time")).not.toExist(),
      expect(selector(".scopes")).not.toExist(),
      expect(selector(".connected-account")).not.toExist(),
    )
  })

  test("preserves successful and denied authorization results", () => {
    scene(
      { update, view },
      given({ ...loadedModel, maybeResult: Option.some("connected") }),
      expect(role("status")).toHaveText("Connection authorized."),
    )
    scene(
      { update, view },
      given({ ...loadedModel, maybeResult: Option.some("denied") }),
      expect(role("status")).toHaveText("Authorization was denied at the Provider."),
    )
    scene({ update, view }, given(loadedModel), expect(role("status")).not.toExist())
  })

  test("shows loading and retries a failed Connection read independently of Channel data", () => {
    scene(
      { update, view },
      given({
        ...loadedModel,
        connections: AsyncData.fail("The Connections could not be loaded."),
      }),
      expect(role("alert")).toHaveText("The Connections could not be loaded."),
      expect(text("Readiness unconfirmed")).toExist(),
      click(role("button", { name: "Refresh" })),
      expect(text("Loading the Connections.")).toExist(),
      Command.resolve(
        FetchConnections,
        Message.SucceededFetchConnections({ connections, checkedAt: now }),
      ),
      expect(role("heading", { name: "Spotify" })).toExist(),
      Command.resolve(FetchChannel, Message.SucceededFetchChannel({ channel, checkedAt: now })),
    )
  })

  test("shows readiness only for current observations, not stale successful data", () => {
    const ready = { ...loadedModel, connections: AsyncData.succeed(authorizedConnections) }
    scene({ update, view }, given(ready), expect(text("No observed blockers")).toExist())
    scene(
      { update, view },
      given({ ...ready, now: now + 30_000 }),
      expect(text("Readiness unconfirmed")).toExist(),
      expect(text("No observed blockers")).not.toExist(),
    )
  })

  test("a failed Channel read is unavailable, not Offline or an empty queue", () => {
    scene(
      { update, view },
      given({
        ...loadedModel,
        channel: AsyncData.fail("Channel read failed"),
        maybeChannelCheckedAt: Option.none(),
      }),
      expect(text("Readiness unavailable")).toExist(),
      expect(text("Processing unavailable")).toExist(),
      expect(text("Offline")).not.toExist(),
      expect(text("No Redemptions waiting.")).not.toExist(),
    )
  })

  test("shows queued input as text and explains held refunds and bounded results", () => {
    const redemption = {
      id: "redemption-1",
      rewardId: "reward-1",
      viewerId: "viewer-1",
      viewerName: "Viewer one",
      input: "<script>alert('unsafe')</script>",
      redeemedAt: DateTime.makeUnsafe(now - 60_000),
    }
    scene(
      { update, view },
      given({
        ...loadedModel,
        isQueueOpen: true,
        isHeldOpen: true,
        channel: AsyncData.succeed({
          ...channel,
          processing: { total: 51, items: [redemption] },
          held: {
            total: 1,
            items: [{ redemption: { ...redemption, id: "held-1" }, reason: "TwitchUnavailable" }],
          },
        }),
      }),
      expect(
        text(
          "Showing the oldest 1 of 51 Redemptions. Newer entries appear as these leave the queue.",
        ),
      ).toExist(),
      expect(
        text("Twitch unavailable when cancellation was attempted. Refund not yet confirmed."),
      ).toExist(),
      expect(selector("main script")).not.toExist(),
      expect(selector("details[open]")).toExist(),
    )
  })
})
