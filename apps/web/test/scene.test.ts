import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import {
  Command,
  all,
  click,
  expect,
  expectAll,
  given,
  role,
  scene,
  selector,
  text,
} from "foldkit/scene"
import { describe, test } from "vite-plus/test"
import { FetchConnections, Message, type Model, update, view } from "../src/main.ts"

const connections = [
  { provider: "spotify", status: "Not Configured" },
  { provider: "twitch", status: "Not Configured" },
] as const

const loadedModel: Model = {
  connections: AsyncData.succeed(connections),
  maybeResult: Option.none(),
}

describe("view", () => {
  test("renders one Not Configured section per Provider with a Connect form", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(role("heading", { name: "Spotify" })).toExist(),
      expect(role("heading", { name: "Twitch" })).toExist(),
      expectAll(all.selector("p.status")).toHaveCount(2),
      expect(selector('section[data-provider="spotify"] p.status')).toHaveText("Not Configured"),
      expect(
        selector(
          'section[data-provider="spotify"] form[method="post"][action="/oauth/spotify/authorize"] button',
        ),
      ).toHaveText("Connect"),
      expect(
        selector(
          'section[data-provider="twitch"] form[method="post"][action="/oauth/twitch/authorize"] button',
        ),
      ).toHaveText("Connect"),
    )
  })

  test("offers Reconnect for a Connection that is not Not Configured", () => {
    scene(
      { update, view },
      given({
        ...loadedModel,
        connections: AsyncData.succeed([{ provider: "twitch", status: "Authorized" }] as const),
      }),
      expect(text("Authorized")).toExist(),
      expect(selector('section[data-provider="twitch"] button')).toHaveText("Reconnect"),
    )
  })

  test("renders a success message from the result", () => {
    scene(
      { update, view },
      given({ ...loadedModel, maybeResult: Option.some("connected") }),
      expect(selector("p.result.success")).toHaveText("Connection authorized."),
    )
  })

  test("renders an error message from the result", () => {
    scene(
      { update, view },
      given({ ...loadedModel, maybeResult: Option.some("denied") }),
      expect(selector("p.result.error")).toHaveText("Authorization was denied at the Provider."),
    )
  })

  test("renders no message without a result", () => {
    scene({ update, view }, given(loadedModel), expect(selector("p.result")).not.toExist())
  })

  test("shows a loading state before the Connections arrive", () => {
    scene(
      { update, view },
      given({ ...loadedModel, connections: AsyncData.Loading() }),
      expect(text("Loading the Connections.")).toExist(),
    )
  })

  test("shows the error and reloads on request", () => {
    scene(
      { update, view },
      given({
        ...loadedModel,
        connections: AsyncData.fail("The Connections could not be loaded."),
      }),
      expect(text("The Connections could not be loaded.")).toExist(),
      click(role("button", { name: "Reload" })),
      expect(text("Loading the Connections.")).toExist(),
      Command.resolve(FetchConnections, Message.SucceededFetchConnections({ connections })),
      expect(role("heading", { name: "Spotify" })).toExist(),
    )
  })
})
