import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import { Command, given, message, model, story } from "foldkit/story"
import { describe, expect, test } from "vite-plus/test"
import { FetchConnections, Message, init, update } from "../src/main.ts"
import { loadingModel, notConfiguredConnections as connections } from "./fixtures.ts"

describe("init", () => {
  test("starts loading the Connections and keeps the result from Flags", () => {
    const start = init({ maybeResult: Option.some("connected") })

    expect(AsyncData.isLoading(start.model.connections)).toBe(true)
    expect(start.model.maybeResult).toEqual(Option.some("connected"))
    expect(start.commands?.map((command) => command.name)).toEqual([FetchConnections.name])
  })
})

describe("update", () => {
  test("SucceededFetchConnections stores the Connections", () => {
    story(
      update,
      given(loadingModel),
      message(Message.SucceededFetchConnections({ connections })),
      Command.expectNone(),
      model((next) => {
        expect(next.connections).toEqual(AsyncData.succeed(connections))
      }),
    )
  })

  test("FailedFetchConnections stores the error", () => {
    story(
      update,
      given(loadingModel),
      message(Message.FailedFetchConnections({ error: "boom" })),
      Command.expectNone(),
      model((next) => {
        expect(next.connections).toEqual(AsyncData.fail("boom"))
      }),
    )
  })

  test("ClickedReload after a failure loads again", () => {
    story(
      update,
      given({ ...loadingModel, connections: AsyncData.fail("boom") }),
      message(Message.ClickedReload()),
      model((next) => {
        expect(AsyncData.isLoading(next.connections)).toBe(true)
      }),
      Command.resolve(FetchConnections, Message.SucceededFetchConnections({ connections })),
      model((next) => {
        expect(next.connections).toEqual(AsyncData.succeed(connections))
      }),
    )
  })

  test("ClickedReload with data keeps showing it while refreshing", () => {
    story(
      update,
      given({ ...loadingModel, connections: AsyncData.succeed(connections) }),
      message(Message.ClickedReload()),
      model((next) => {
        expect(AsyncData.isRefreshing(next.connections)).toBe(true)
        expect(AsyncData.getData(next.connections)).toEqual(Option.some(connections))
      }),
      Command.resolve(FetchConnections, Message.FailedFetchConnections({ error: "boom" })),
      model((next) => {
        expect(AsyncData.isStale(next.connections)).toBe(true)
        expect(AsyncData.getData(next.connections)).toEqual(Option.some(connections))
      }),
    )
  })
})
