import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type { OperatorIdentity } from "@twitch-integrations/domain/OperatorIdentity"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"

export const operator: OperatorIdentity = {
  userUuid: "8d5c1a1e-4b7e-4d2b-9c1a-2f3e4d5c6b7a",
  email: "operator@example.com",
}

export const authorizedConnection: Connection = {
  accessToken: Redacted.make("access-token-1"),
  refreshToken: Option.some(Redacted.make("refresh-token-1")),
  scopes: ["user-read-currently-playing", "user-read-playback-state"],
  tokenType: "Bearer",
  expiresAt: DateTime.makeUnsafe("2026-09-11T13:00:00Z"),
  status: "Authorized",
  refreshRetryCount: 0,
  nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-11T12:55:00Z")),
  lastRefreshError: Option.none(),
  connectedAccount: { id: "spotify-user-1", displayName: "Max" },
}

/** An Attempt created at noon that expires ten minutes later. */
export const pendingAttempt: AuthorizationAttempt = {
  state: "state-abc",
  provider: "spotify",
  callbackUri: "https://worker.example/oauth/spotify/callback",
  operator,
  createdAt: DateTime.makeUnsafe("2026-09-11T12:00:00Z"),
  expiresAt: DateTime.makeUnsafe("2026-09-11T12:10:00Z"),
  consumed: false,
}
