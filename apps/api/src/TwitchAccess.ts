import {
  ConnectionNotConfigured,
  type ReauthorizationRequired,
} from "@twitch-integrations/domain/ConnectionErrors"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Connections } from "./Connections.ts"
import type { AccessToken } from "./Helix.ts"
import type { ProviderRequestFailed } from "./Provider.ts"

/** What every Helix call on the Broadcaster's behalf needs: the Twitch Connection's token and whose channel it is. */
export interface TwitchAccessGrant {
  readonly token: AccessToken
  /** The Twitch Connected Account's ID, which Helix names as the broadcaster. */
  readonly account: string
}

export interface TwitchAccessService {
  /** The Twitch Connection's current token and Connected Account, or the Connection's own failure when it has none to give. */
  readonly current: Effect.Effect<
    TwitchAccessGrant,
    ConnectionNotConfigured | ReauthorizationRequired | ProviderRequestFailed
  >
}

const make = Effect.gen(function* () {
  const connections = yield* Connections
  const current: TwitchAccessService["current"] = Effect.gen(function* () {
    const token = yield* connections.getAccessToken("twitch")
    const summary = yield* connections.describe("twitch")
    if (summary.connectedAccount === null) {
      return yield* ConnectionNotConfigured.make({ provider: "twitch" })
    }
    return { token, account: summary.connectedAccount.id }
  })
  return TwitchAccess.of({ current })
})

/** The Channel's way onto the Twitch channel: the Connection's token, asked for fresh on every use. */
export class TwitchAccess extends Context.Service<TwitchAccess, TwitchAccessService>()(
  "@twitch-integrations/api/TwitchAccess",
) {
  static readonly layer: Layer.Layer<TwitchAccess, never, Connections> =
    Layer.effect(TwitchAccess)(make)
}
