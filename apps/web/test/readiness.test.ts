import { SongRequestReadiness } from "@twitch-integrations/domain/SongRequestReadiness"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { describe, expect, test } from "vite-plus/test"
import { authorizedConnections, channel, now } from "./fixtures.ts"

describe("Song Request readiness", () => {
  test("reports no observed blockers only with both accounts and all Channel prerequisites", () => {
    expect(SongRequestReadiness.evaluate(channel, authorizedConnections, now)._tag).toBe("Ready")
  })

  test("blocks missing or expired authorizations and missing permissions", () => {
    expect(SongRequestReadiness.evaluate(channel, [], now)._tag).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        channel,
        authorizedConnections.map((connection) => ({
          ...connection,
          expiresAt: Option.some(DateTime.makeUnsafe(now)),
        })),
        now,
      )._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        channel,
        authorizedConnections.map((connection) => ({ ...connection, scopes: [] })),
        now,
      )._tag,
    ).toBe("Blocked")
  })

  test("blocks an Offline Channel, absent or paused Reward, and revoked or unconfirmed Event Subscriptions", () => {
    expect(
      SongRequestReadiness.evaluate({ ...channel, state: "Offline" }, authorizedConnections, now)
        ._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        { ...channel, reward: Option.none() },
        authorizedConnections,
        now,
      )._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        {
          ...channel,
          reward: Option.map(channel.reward, (reward) => ({ ...reward, isPaused: true })),
        },
        authorizedConnections,
        now,
      )._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        { ...channel, eventSubscriptions: [] },
        authorizedConnections,
        now,
      )._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        {
          ...channel,
          eventSubscriptions: channel.eventSubscriptions.map((subscription) => ({
            ...subscription,
            revocationReason: Option.some("authorization_revoked"),
          })),
        },
        authorizedConnections,
        now,
      )._tag,
    ).toBe("Blocked")
    expect(
      SongRequestReadiness.evaluate(
        {
          ...channel,
          eventSubscriptions: channel.eventSubscriptions.map((subscription) => ({
            ...subscription,
            status: "webhook_callback_verification_pending",
          })),
        },
        authorizedConnections,
        now,
      )._tag,
    ).toBe("Blocked")
  })
})
