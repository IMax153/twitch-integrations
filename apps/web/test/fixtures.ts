import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Model } from "../src/main.ts"

export const notConfiguredConnections: ReadonlyArray<ConnectionSummary> = [
  { provider: "spotify", status: "Not Configured" },
  { provider: "twitch", status: "Not Configured" },
]

export const loadingModel: Model = {
  connections: AsyncData.Loading(),
  maybeResult: Option.none(),
}

export const loadedModel: Model = {
  connections: AsyncData.succeed(notConfiguredConnections),
  maybeResult: Option.none(),
}
