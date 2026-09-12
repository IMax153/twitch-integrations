import type { AuthorizationAttempt } from "@twitch-integrations/domain/AuthorizationAttempt"
import type { Connection } from "@twitch-integrations/domain/Connection"
import type { EventSubscription } from "@twitch-integrations/domain/EventSubscription"
import { type Reward, songRequestSettings } from "@twitch-integrations/domain/Reward"
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

/** The Song Request Reward as the fake Helix holds it, already manageable by this client ID. */
export const manageableSongRequest = {
  id: "reward-1",
  title: songRequestSettings.title,
  cost: songRequestSettings.cost,
  prompt: songRequestSettings.prompt,
  is_paused: false,
}

/** The Song Request Reward as the deployment stores it once created, unpaused. */
export const songRequestReward: Reward = {
  id: "reward-1",
  ...songRequestSettings,
  isPaused: false,
}

/** The three Event Subscriptions the deployment keeps, as Twitch reported them enabled. */
export const storedSubscriptions: ReadonlyArray<EventSubscription> = [
  {
    id: "sub-redemption",
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    status: "enabled",
    revocationReason: Option.none(),
  },
  {
    id: "sub-online",
    type: "stream.online",
    version: "1",
    status: "enabled",
    revocationReason: Option.none(),
  },
  {
    id: "sub-offline",
    type: "stream.offline",
    version: "1",
    status: "enabled",
    revocationReason: Option.none(),
  },
]

/** The Twitch Connection, authorized for the Connected Account "max" with the user ID "twitch-user-1". */
export const twitchConnection: Connection = {
  ...authorizedConnection,
  scopes: ["channel:manage:redemptions", "user:write:chat"],
  connectedAccount: { id: "twitch-user-1", displayName: "max" },
}
