import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import type { ChannelMonitoring } from "./ChannelMonitoring.ts"
import type { ConnectionSummary } from "./ConnectionSummary.ts"
import { EventSubscriptionType } from "./EventSubscription.ts"
import { ProviderName, providerLabels } from "./ProviderName.ts"

export type SongRequestReadiness =
  | { readonly _tag: "Ready" }
  | { readonly _tag: "Blocked"; readonly reasons: Array.NonEmptyReadonlyArray<string> }

const requiredScopes: Record<ProviderName, ReadonlyArray<string>> = {
  spotify: ["user-modify-playback-state", "user-read-playback-state"],
  twitch: ["channel:read:redemptions", "channel:manage:redemptions"],
}

const connectionReasons = (connections: ReadonlyArray<ConnectionSummary>, now: number) =>
  Array.flatMap(ProviderName.literals, (provider) => {
    const connection = connections.find((item) => item.provider === provider)
    const label = providerLabels[provider]
    if (connection === undefined || connection.status !== "Authorized") {
      return [`${label} needs authorization.`]
    }
    if (Option.isNone(connection.connectedAccount)) {
      return [`${label} has no confirmed Connected Account. Reconnect to confirm it.`]
    }
    if (
      Option.isNone(connection.expiresAt) ||
      DateTime.toEpochMillis(connection.expiresAt.value) <= now
    ) {
      return [`${label} has no current access token. Waiting for refresh.`]
    }
    return requiredScopes[provider].every((scope) => connection.scopes.includes(scope))
      ? []
      : [`${label} is missing Song Request permissions. Reconnect to grant them.`]
  })

/** Evaluates only observed prerequisites. It never claims that a playback device is available. */
const evaluate = (
  channel: ChannelMonitoring,
  connections: ReadonlyArray<ConnectionSummary>,
  now: number,
): SongRequestReadiness => {
  const reasons = [
    ...connectionReasons(connections, now),
    ...(channel.state === "Offline"
      ? ["The Channel is Offline. Rewards are paused while Offline."]
      : []),
    ...Option.match(channel.reward, {
      onNone: () => ["The Song Request Reward has not been configured."],
      onSome: (reward) =>
        reward.isPaused && channel.state === "Live" ? ["The Song Request Reward is paused."] : [],
    }),
    ...Array.map(
      Array.filter(
        EventSubscriptionType.literals,
        (type) =>
          !channel.eventSubscriptions.some(
            (subscription) =>
              subscription.type === type &&
              subscription.status === "enabled" &&
              Option.isNone(subscription.revocationReason),
          ),
      ),
      (type) => `Event Subscription not enabled: ${type}.`,
    ),
  ]
  return Array.match(reasons, {
    onEmpty: () => ({ _tag: "Ready" }),
    onNonEmpty: (reasons) => ({ _tag: "Blocked", reasons }),
  })
}

export const SongRequestReadiness = { evaluate } as const
