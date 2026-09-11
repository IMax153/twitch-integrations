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
import {
  authorizedTwitch,
  loadedModel,
  notConfiguredConnections as connections,
  strugglingTwitch,
} from "./fixtures.ts"

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

  test("shows an Authorized Connection's account, scopes, and expiry with a Reconnect button", () => {
    scene(
      { update, view },
      given({ ...loadedModel, connections: AsyncData.succeed([authorizedTwitch]) }),
      expect(selector('section[data-provider="twitch"] p.status')).toHaveText("Authorized"),
      expect(selector('section[data-provider="twitch"] .connected-account')).toHaveText(
        "twitchdev (141981764)",
      ),
      expectAll(all.selector('section[data-provider="twitch"] ul.scopes li')).toHaveCount(2),
      expect(text("user:read:chat")).toExist(),
      expect(text("user:write:chat")).toExist(),
      expect(selector('section[data-provider="twitch"] .expires-at')).toHaveText(
        "2026-09-11T13:00:00.000Z",
      ),
      expect(selector('section[data-provider="twitch"] .next-refresh-at')).toHaveText(
        "Next refresh at 2026-09-11T12:55:00.000Z",
      ),
      expect(selector('section[data-provider="twitch"] .last-refresh-error')).not.toExist(),
      expect(selector('section[data-provider="twitch"] button')).toHaveText("Reconnect"),
    )
  })

  test("shows the last refresh error and the retry it scheduled", () => {
    scene(
      { update, view },
      given({ ...loadedModel, connections: AsyncData.succeed([strugglingTwitch]) }),
      expect(selector('section[data-provider="twitch"] .last-refresh-error')).toHaveText(
        "Last refresh error at 2026-09-11T12:55:00.000Z: The Twitch refresh request got no answer.",
      ),
      expect(selector('section[data-provider="twitch"] .next-refresh-at')).toHaveText(
        "Next refresh at 2026-09-11T12:56:00.000Z",
      ),
    )
  })

  test("shows no account, scopes, expiry, or refresh details while Not Configured", () => {
    scene(
      { update, view },
      given(loadedModel),
      expect(selector('section[data-provider="twitch"] .connected-account')).not.toExist(),
      expect(selector('section[data-provider="twitch"] ul.scopes')).not.toExist(),
      expect(selector('section[data-provider="twitch"] .expires-at')).not.toExist(),
      expect(selector('section[data-provider="twitch"] .next-refresh-at')).not.toExist(),
      expect(selector('section[data-provider="twitch"] .last-refresh-error')).not.toExist(),
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
