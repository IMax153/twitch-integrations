import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Model } from "../src/main.ts"

export const notConfiguredConnections: ReadonlyArray<ConnectionSummary> = [
  {
    provider: "spotify",
    status: "Not Configured",
    connectedAccount: Option.none(),
    scopes: [],
    expiresAt: Option.none(),
  },
  {
    provider: "twitch",
    status: "Not Configured",
    connectedAccount: Option.none(),
    scopes: [],
    expiresAt: Option.none(),
  },
]

export const authorizedTwitch: ConnectionSummary = {
  provider: "twitch",
  status: "Authorized",
  connectedAccount: Option.some({ id: "141981764", displayName: "twitchdev" }),
  scopes: ["user:read:chat", "user:write:chat"],
  expiresAt: Option.some(DateTime.makeUnsafe("2026-09-11T13:00:00Z")),
}

export const loadingModel: Model = {
  connections: AsyncData.Loading(),
  maybeResult: Option.none(),
}

export const loadedModel: Model = {
  connections: AsyncData.succeed(notConfiguredConnections),
  maybeResult: Option.none(),
}
