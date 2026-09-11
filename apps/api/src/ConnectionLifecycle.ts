import type { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import type { Connection } from "@twitch-integrations/domain/Connection"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ConnectionStore } from "./ConnectionStore.ts"
import type { TokenResponse } from "./Provider.ts"

export interface ConnectionLifecycleService {
  /**
   * Installs a token response as the Connection for the Connected Account.
   * A refresh token or scope list the Provider left out is carried over from
   * the previous Connection; with no refresh token anywhere the Connection is
   * Reauthorization Required, since it can never be refreshed.
   */
  readonly accept: (
    response: TokenResponse,
    connectedAccount: ConnectedAccount,
  ) => Effect.Effect<Connection>
}

const make = Effect.gen(function* () {
  const store = yield* ConnectionStore

  return ConnectionLifecycle.of({
    accept: (response, connectedAccount) =>
      Effect.gen(function* () {
        const previous = yield* store.readConnection
        const now = yield* DateTime.now
        const refreshToken = Option.orElse(response.refreshToken, () =>
          Option.flatMap(previous, (connection) => connection.refreshToken),
        )
        const scopes = Option.getOrElse(response.scopes, () =>
          Option.match(previous, { onNone: () => [], onSome: (connection) => connection.scopes }),
        )
        const connection: Connection = {
          accessToken: response.accessToken,
          refreshToken,
          scopes,
          tokenType: response.tokenType,
          expiresAt: DateTime.addDuration(now, response.expiresIn),
          status: Option.isSome(refreshToken) ? "Authorized" : "Reauthorization Required",
          refreshRetryCount: 0,
          nextRefreshAt: Option.none(),
          lastRefreshError: Option.none(),
          connectedAccount,
        }
        yield* store.writeConnection(connection)
        return connection
      }),
  })
})

/** The rules for how one Provider's Connection changes over time. All time comes from the Clock. */
export class ConnectionLifecycle extends Context.Service<
  ConnectionLifecycle,
  ConnectionLifecycleService
>()("@twitch-integrations/api/ConnectionLifecycle") {
  static readonly layer: Layer.Layer<ConnectionLifecycle, never, ConnectionStore> =
    Layer.effect(ConnectionLifecycle)(make)
}
