import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Model } from "../src/main.ts"
import { init } from "../src/main.ts"

export const now = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-11T12:00:00Z"))

export const channel: ChannelMonitoring = {
  observedAt: DateTime.makeUnsafe(now),
  state: "Live",
  reward: Option.some({
    id: "reward-1",
    title: "Song Request",
    cost: 1,
    prompt: "Paste a Spotify track link.",
    isPaused: false,
  }),
  eventSubscriptions: [
    {
      id: "redemptions",
      type: "channel.channel_points_custom_reward_redemption.add",
      version: "1",
      status: "enabled",
      revocationReason: Option.none(),
    },
    {
      id: "online",
      type: "stream.online",
      version: "1",
      status: "enabled",
      revocationReason: Option.none(),
    },
    {
      id: "offline",
      type: "stream.offline",
      version: "1",
      status: "enabled",
      revocationReason: Option.none(),
    },
  ],
  processing: { total: 0, items: [] },
  held: { total: 0, items: [] },
  chatCommands: [],
}

export const notConfiguredConnections: ReadonlyArray<ConnectionSummary> = [
  {
    provider: "spotify",
    status: "Not Configured",
    connectedAccount: Option.none(),
    scopes: [],
    expiresAt: Option.none(),
    nextRefreshAt: Option.none(),
    lastRefreshError: Option.none(),
  },
  {
    provider: "twitch",
    status: "Not Configured",
    connectedAccount: Option.none(),
    scopes: [],
    expiresAt: Option.none(),
    nextRefreshAt: Option.none(),
    lastRefreshError: Option.none(),
  },
]

export const authorizedTwitch: ConnectionSummary = {
  provider: "twitch",
  status: "Authorized",
  connectedAccount: Option.some({ id: "141981764", displayName: "twitchdev" }),
  scopes: ["user:read:chat", "user:write:chat"],
  expiresAt: Option.some(DateTime.makeUnsafe("2026-09-11T13:00:00Z")),
  nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-11T12:55:00Z")),
  lastRefreshError: Option.none(),
}

/** The Twitch Connection after a refresh failed and a retry was scheduled. */
export const strugglingTwitch: ConnectionSummary = {
  ...authorizedTwitch,
  nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-11T12:56:00Z")),
  lastRefreshError: Option.some({
    message: "The Twitch refresh request got no answer.",
    at: DateTime.makeUnsafe("2026-09-11T12:55:00Z"),
  }),
}

export const loadingModel = init({ maybeResult: Option.none(), now, isVisible: true }).model

export const loadedModel: Model = {
  ...loadingModel,
  connections: AsyncData.succeed(notConfiguredConnections),
  channel: AsyncData.succeed(channel),
  maybeConnectionsCheckedAt: Option.some(now),
  maybeChannelCheckedAt: Option.some(now),
}

export const authorizedConnections: ReadonlyArray<ConnectionSummary> = [
  {
    ...authorizedTwitch,
    provider: "spotify",
    connectedAccount: Option.some({ id: "spotify-1", displayName: "minbadblue" }),
    scopes: ["user-modify-playback-state", "user-read-playback-state"],
  },
  { ...authorizedTwitch, scopes: ["channel:manage:redemptions", "channel:read:redemptions"] },
]
