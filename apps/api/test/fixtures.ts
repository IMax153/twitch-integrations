import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type { BroadcasterIdentity } from "@twitch-integrations/domain/BroadcasterIdentity"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import type { ProviderScenario, TokenGrant } from "./FakeProviders.ts"

export const broadcaster: BroadcasterIdentity = {
  userUuid: "8d5c1a1e-4b7e-4d2b-9c1a-2f3e4d5c6b7a",
  email: "broadcaster@example.com",
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

/** The Connection three short retries in, with its retry due at 12:04 and an error on record. */
export const strugglingConnection: Connection = {
  ...authorizedConnection,
  refreshRetryCount: 3,
  nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-11T12:04:00Z")),
  lastRefreshError: Option.some({
    message: "rate limited",
    at: DateTime.makeUnsafe("2026-09-11T12:00:00Z"),
  }),
}

/** An Attempt created at noon that expires ten minutes later. */
export const pendingAttempt: AuthorizationAttempt = {
  state: "state-abc",
  provider: "spotify",
  callbackUri: "https://worker.example/oauth/spotify/callback",
  broadcaster,
  createdAt: DateTime.makeUnsafe("2026-09-11T12:00:00Z"),
  expiresAt: DateTime.makeUnsafe("2026-09-11T12:10:00Z"),
  consumed: false,
}

/** A full set of tokens: an hour of validity, a rotated refresh token, and a scope list. */
export const grantedTokens: TokenGrant = {
  accessToken: "granted-access-token",
  refreshToken: Option.some("granted-refresh-token"),
  expiresIn: 3600,
  scopes: Option.some(["scope-a", "scope-b"]),
}

/** A Provider granting the full set of tokens to the account "Max". */
export const grantedScenario: ProviderScenario = {
  token: { _tag: "Grant", grant: grantedTokens },
  account: { id: "account-1", displayName: "Max" },
}
