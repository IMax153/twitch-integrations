import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, given, message, model, story } from "foldkit/story"
import { describe, expect, test } from "vite-plus/test"
import { FetchChannel, FetchConnections, Message, init, update } from "../src/main.ts"
import {
  channel,
  loadedModel,
  loadingModel,
  now,
  notConfiguredConnections as connections,
} from "./fixtures.ts"

describe("monitoring refresh", () => {
  test("settles Channel success and failure without changing Connections", () => {
    story(
      update,
      given(loadingModel),
      message(Message.SucceededFetchChannel({ channel, checkedAt: now })),
      model((next) => {
        expect(AsyncData.getData(next.channel)).toEqual(Option.some(channel))
        expect(AsyncData.isLoading(next.connections)).toBe(true)
      }),
      message(Message.ClickedReload()),
      Command.resolve(FetchChannel, Message.FailedFetchChannel({ error: "Channel unavailable" })),
      model((next) => {
        expect(AsyncData.isStale(next.channel)).toBe(true)
        expect(AsyncData.getData(next.channel)).toEqual(Option.some(channel))
        expect(next.maybeChannelCheckedAt).toEqual(Option.some(now))
      }),
      message(Message.ClickedReload()),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 10_000 }),
      ),
      model((next) => expect(AsyncData.isSuccess(next.channel)).toBe(true)),
    )
  })

  test("starts no requests in a hidden page, refreshes on return, and does not overlap reads", () => {
    const hidden = init({ maybeResult: Option.none(), now, isVisible: false })
    expect(hidden.commands).toHaveLength(0)
    story(
      update,
      given(hidden.model),
      message(Message.TickedClock({ now: now + 60_000 })),
      Command.expectNone(),
      message(Message.UpdatedVisibility({ isVisible: true, now: now + 60_000 })),
      Command.resolve(
        FetchConnections,
        Message.SucceededFetchConnections({ connections, checkedAt: now + 60_000 }),
      ),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 60_000 }),
      ),
      message(Message.TickedClock({ now: now + 69_999 })),
      Command.expectNone(),
      message(Message.TickedClock({ now: now + 70_000 })),
      model((next) => {
        expect(AsyncData.isRefreshing(next.channel)).toBe(true)
        expect(AsyncData.isRefreshing(next.connections)).toBe(true)
        expect(update(next, Message.ClickedReload()).commands ?? []).toHaveLength(0)
      }),
      Command.resolve(
        FetchConnections,
        Message.SucceededFetchConnections({ connections, checkedAt: now + 70_000 }),
      ),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 70_000 }),
      ),
    )
  })

  test("retains open details and good Channel data when Connection refresh fails", () => {
    story(
      update,
      given(loadedModel),
      message(Message.ToggledQueue({ isOpen: true })),
      message(Message.ToggledHeld({ isOpen: true })),
      message(Message.ToggledConnection({ provider: "spotify", isOpen: true })),
      message(Message.ClickedReload()),
      Command.resolve(
        FetchConnections,
        Message.FailedFetchConnections({ error: "Connections unavailable" }),
      ),
      Command.resolve(
        FetchChannel,
        Message.SucceededFetchChannel({ channel, checkedAt: now + 500 }),
      ),
      model((next) => {
        expect(next.isQueueOpen).toBe(true)
        expect(next.isHeldOpen).toBe(true)
        expect(next.expandedProviders).toEqual(["spotify"])
        expect(AsyncData.isStale(next.connections)).toBe(true)
        expect(AsyncData.isSuccess(next.channel)).toBe(true)
      }),
    )
  })

  test("a first Channel failure stays a failure until retried", () => {
    story(
      update,
      given(loadingModel),
      message(Message.FailedFetchChannel({ error: "Unavailable" })),
      model((next) => {
        expect(AsyncData.isFailure(next.channel)).toBe(true)
        expect(next.maybeChannelCheckedAt).toEqual(Option.none())
      }),
    )
  })
})
