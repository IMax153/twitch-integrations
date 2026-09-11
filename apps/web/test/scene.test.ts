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
import { FetchConnections, Message, update, view } from "../src/main.ts"
import { loadedModel, notConfiguredConnections as connections } from "./fixtures.ts"

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
      expect(role("status")).toHaveText("Connection authorized."),
      expect(selector("p.result.success")).toExist(),
    )
  })

  test("renders an error message from the result", () => {
    scene(
      { update, view },
      given({ ...loadedModel, maybeResult: Option.some("denied") }),
      expect(role("status")).toHaveText("Authorization was denied at the Provider."),
      expect(selector("p.result.error")).toExist(),
    )
  })

  test("renders no message without a result", () => {
    scene({ update, view }, given(loadedModel), expect(role("status")).not.toExist())
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
      expect(role("alert")).toHaveText("The Connections could not be loaded."),
      click(role("button", { name: "Reload" })),
      expect(text("Loading the Connections.")).toExist(),
      Command.resolve(FetchConnections, Message.SucceededFetchConnections({ connections })),
      expect(role("heading", { name: "Spotify" })).toExist(),
    )
  })
})
