import { assert, describe, it } from "@effect/vitest"
import { ConnectionNotConfigured } from "@twitch-integrations/domain/ConnectionErrors"
import {
  Notification,
  type NotificationEncoded,
  type NotificationEvent,
} from "@twitch-integrations/domain/Notification"
import { songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import {
  type BroadcasterWorld,
  type WorldOptions,
  makeBroadcasterWorld,
  makeWorld,
  testTransport,
} from "./BroadcasterHarness.ts"
import type { ReceivedRequest } from "./FakeApi.ts"
import type { TwitchHelixScenario } from "./FakeProviders.ts"
import {
  manageableSongRequest,
  songRequestReward,
  storedSubscriptions,
  twitchConnection,
} from "./fixtures.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso).pipe(DateTime.toEpochMillis, TestClock.setTime)

/** Helix as the tests start it: accepting the stored Connection's token, with whatever else the test says. */
const helixScenario = (
  scenario: Omit<TwitchHelixScenario, "accessToken"> = {},
): TwitchHelixScenario => ({
  accessToken: Option.some("access-token-1"),
  ...scenario,
})

/** The world at noon with Twitch authorized, its token fresh, and Helix accepting it. */
const worldWithTwitch = Effect.fnUntraced(function* (
  scenario: Omit<TwitchHelixScenario, "accessToken"> = {},
  options: WorldOptions = {},
) {
  const world = yield* makeWorld(options)
  yield* at("2026-09-11T12:00:00Z")
  yield* world.stores.twitch.writeConnection(twitchConnection)
  yield* world.providers.twitchHelix.set(helixScenario(scenario))
  return world
})

/** A request as a test names it: its method, and its URL with the query string. */
const line = (request: ReceivedRequest) => `${request.method} ${request.url}`

const lines = (requests: ReadonlyArray<ReceivedRequest>) => requests.map(line)

const rewardsUrl = "https://api.twitch.tv/helix/channel_points/custom_rewards"

const subscriptionsUrl = "https://api.twitch.tv/helix/eventsub/subscriptions"

const streamsUrl = "https://api.twitch.tv/helix/streams"

/** The settings as Helix receives them: the three the spec varies, and the fixed ones. */
const settingsBody = {
  title: "Song Request",
  cost: 1,
  prompt: songRequestSettings.prompt,
  is_user_input_required: true,
  is_max_per_stream_enabled: false,
  is_max_per_user_per_stream_enabled: false,
  is_global_cooldown_enabled: false,
  should_redemptions_skip_request_queue: false,
}

const helixRequests = (world: BroadcasterWorld) => world.providers.twitchHelix.received

/** The reward requests Helix received, the only ones a test about the Reward is interested in. */
const rewardRequests = (world: BroadcasterWorld) =>
  Effect.map(helixRequests(world), (requests) =>
    requests.filter((request) => request.url.startsWith(rewardsUrl)),
  )

const subscriptionRequests = (world: BroadcasterWorld) =>
  Effect.map(helixRequests(world), (requests) =>
    requests.filter((request) => request.url.startsWith(subscriptionsUrl)),
  )

/** What the client credentials grant was asked for, if it was. */
const appTokenRequests = (world: BroadcasterWorld) =>
  Effect.map(world.providers.twitchAuth.received, (requests) =>
    requests.filter((request) => request.form["grant_type"] === "client_credentials"),
  )

describe("ChannelObject.reconcile", () => {
  it.effect("creates the Song Request Reward when none is stored and none is manageable", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch()
      yield* world.channel.reconcile()
      const [listed, created] = yield* helixRequests(world)
      assert.strictEqual(
        listed === undefined ? undefined : line(listed),
        `GET ${rewardsUrl}?broadcaster_id=twitch-user-1&only_manageable_rewards=true`,
      )
      assert.strictEqual(
        created === undefined ? undefined : line(created),
        `POST ${rewardsUrl}?broadcaster_id=twitch-user-1`,
      )
      assert.deepStrictEqual(created?.json, settingsBody)
      assert.strictEqual(created?.headers["authorization"], "Bearer access-token-1")
      assert.strictEqual(created?.headers["client-id"], "twitch-client-id")
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ id: "reward-created", ...songRequestSettings, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("adopts a manageable reward with the title instead of creating a second", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({
        manageableRewards: [
          { ...manageableSongRequest, cost: 500, prompt: "Old prompt" },
          { id: "reward-other", title: "Hydrate", cost: 100, prompt: "", is_paused: false },
        ],
      })
      yield* world.channel.reconcile()
      const requests = yield* rewardRequests(world)
      assert.deepStrictEqual(lines(requests), [
        `GET ${rewardsUrl}?broadcaster_id=twitch-user-1&only_manageable_rewards=true`,
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      ])
      assert.deepStrictEqual(requests[1]?.json, settingsBody)
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ ...songRequestReward, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("updates the stored Reward in place without listing or creating", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({
        manageableRewards: [{ ...manageableSongRequest, title: "Song Request (old)" }],
      })
      yield* world.channelStore.writeReward({ ...songRequestReward, title: "Song Request (old)" })
      yield* world.channel.reconcile()
      const requests = yield* rewardRequests(world)
      assert.deepStrictEqual(lines(requests), [
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      ])
      assert.deepStrictEqual(requests[0]?.json, settingsBody)
      assert.deepStrictEqual(requests[1]?.json, { is_paused: true })
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ ...songRequestReward, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("never deletes a reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({
        manageableRewards: [
          manageableSongRequest,
          { id: "reward-dup", title: "Song Request", cost: 1, prompt: "", is_paused: false },
        ],
      })
      yield* world.channel.reconcile()
      const methods = (yield* rewardRequests(world)).map((request) => request.method)
      assert.notInclude(methods, "DELETE")
    }).pipe(Effect.scoped),
  )

  it.effect("replaces this client ID's Event Subscriptions with the three the spec names", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({
        eventSubscriptions: [
          { id: "old-1", type: "stream.online", version: "1", status: "enabled" },
          {
            id: "old-2",
            type: "channel.update",
            version: "2",
            status: "notification_failures_exceeded",
          },
        ],
      })
      yield* world.channel.reconcile()
      const requests = yield* subscriptionRequests(world)
      assert.deepStrictEqual(lines(requests), [
        `GET ${subscriptionsUrl}`,
        `DELETE ${subscriptionsUrl}?id=old-1`,
        `DELETE ${subscriptionsUrl}?id=old-2`,
        `POST ${subscriptionsUrl}`,
        `POST ${subscriptionsUrl}`,
        `POST ${subscriptionsUrl}`,
      ])
      const transport = {
        method: "webhook",
        callback: testTransport.callback,
        secret: testTransport.secret,
      }
      assert.deepStrictEqual(
        requests.slice(3).map((request) => request.json),
        [
          {
            type: "channel.channel_points_custom_reward_redemption.add",
            version: "1",
            condition: { broadcaster_user_id: "twitch-user-1", reward_id: "reward-created" },
            transport,
          },
          {
            type: "stream.online",
            version: "1",
            condition: { broadcaster_user_id: "twitch-user-1" },
            transport,
          },
          {
            type: "stream.offline",
            version: "1",
            condition: { broadcaster_user_id: "twitch-user-1" },
            transport,
          },
        ],
      )
      // Every Event Subscription call carries the app access token, never the Connection's.
      assert.deepStrictEqual(
        new Set(requests.map((request) => request.headers["authorization"])),
        new Set(["Bearer app-access-token"]),
      )
      assert.deepStrictEqual(yield* world.channelStore.readEventSubscriptions, [
        {
          id: "created-channel.channel_points_custom_reward_redemption.add",
          type: "channel.channel_points_custom_reward_redemption.add",
          version: "1",
          status: "webhook_callback_verification_pending",
          revocationReason: Option.none(),
        },
        {
          id: "created-stream.online",
          type: "stream.online",
          version: "1",
          status: "webhook_callback_verification_pending",
          revocationReason: Option.none(),
        },
        {
          id: "created-stream.offline",
          type: "stream.offline",
          version: "1",
          status: "webhook_callback_verification_pending",
          revocationReason: Option.none(),
        },
      ])
    }).pipe(Effect.scoped),
  )

  it.effect("obtains the app access token by client credentials once and reuses it", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch()
      yield* world.channel.reconcile()
      yield* world.channel.reconcile()
      const grants = yield* appTokenRequests(world)
      assert.lengthOf(grants, 1)
      assert.strictEqual(grants[0]?.url, "https://id.twitch.tv/oauth2/token")
      assert.deepStrictEqual(grants[0]?.form, {
        grant_type: "client_credentials",
        client_id: "twitch-client-id",
        client_secret: "twitch-client-secret",
      })
      // Each reconcile listed once and created three; nothing else changed between them.
      const eachTime = [`GET ${subscriptionsUrl}`, ...Array(3).fill(`POST ${subscriptionsUrl}`)]
      assert.deepStrictEqual(lines(yield* subscriptionRequests(world)), [...eachTime, ...eachTime])
    }).pipe(Effect.scoped),
  )

  it.effect("leaves Event Subscriptions alone under alchemy dev", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch(
        {
          eventSubscriptions: [
            { id: "prod-1", type: "stream.online", version: "1", status: "enabled" },
          ],
        },
        { eventSubscriptions: false },
      )
      yield* world.channel.reconcile()
      assert.deepStrictEqual(yield* subscriptionRequests(world), [])
      assert.deepStrictEqual(yield* appTokenRequests(world), [])
      assert.deepStrictEqual(yield* world.channelStore.readEventSubscriptions, [])
      // The rest of the reconcile still runs.
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ id: "reward-created", ...songRequestSettings, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("seeds Live from Get Streams and unpauses the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({ live: true })
      yield* world.channelStore.writeState("Offline")
      yield* world.channel.reconcile()
      const requests = yield* helixRequests(world)
      assert.include(lines(requests), `GET ${streamsUrl}?user_id=twitch-user-1`)
      const last = requests[requests.length - 1]
      assert.strictEqual(
        last === undefined ? undefined : line(last),
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-created`,
      )
      assert.deepStrictEqual(last?.json, { is_paused: false })
      assert.strictEqual(yield* world.channelStore.readState, "Live")
      assert.deepStrictEqual(
        Option.map(yield* world.channelStore.readReward, (reward) => reward.isPaused),
        Option.some(false),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("seeds Offline from an empty Get Streams and pauses the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({ live: false })
      yield* world.channelStore.writeState("Live")
      yield* world.channel.reconcile()
      const requests = yield* helixRequests(world)
      const last = requests[requests.length - 1]
      assert.deepStrictEqual(last?.json, { is_paused: true })
      assert.strictEqual(yield* world.channelStore.readState, "Offline")
      assert.deepStrictEqual(
        Option.map(yield* world.channelStore.readReward, (reward) => reward.isPaused),
        Option.some(true),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("fails Not Configured and touches nothing while Twitch has no Connection", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* at("2026-09-11T12:00:00Z")
      const failure = yield* Effect.flip(world.channel.reconcile())
      assert.deepStrictEqual(failure, ConnectionNotConfigured.make({ provider: "twitch" }))
      assert.deepStrictEqual(yield* world.providers.received, [])
      assert.deepStrictEqual(yield* world.channelStore.readReward, Option.none())
    }).pipe(Effect.scoped),
  )
})

describe("ChannelObject construction", () => {
  it.effect("reconciles itself when the stored Reward's settings differ from the spec", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({ manageableRewards: [manageableSongRequest] })
      yield* world.channelStore.writeReward({ ...songRequestReward, cost: 250 })
      yield* world.rebuildChannel
      const requests = yield* rewardRequests(world)
      assert.deepStrictEqual(lines(requests), [
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      ])
      assert.deepStrictEqual(requests[0]?.json, settingsBody)
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ ...songRequestReward, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("leaves Twitch alone when the stored Reward already matches the spec", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch()
      yield* world.channelStore.writeReward(songRequestReward)
      yield* world.rebuildChannel
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("leaves Twitch alone when nothing is stored", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch()
      yield* world.rebuildChannel
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("still builds when its own reconcile fails", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      yield* world.channelStore.writeReward({ ...songRequestReward, cost: 250 })
      const channel = yield* world.rebuildChannel
      // No Twitch Connection, so the start-up reconcile failed; the object still answers.
      const failure = yield* Effect.flip(channel.reconcile())
      assert.deepStrictEqual(failure, ConnectionNotConfigured.make({ provider: "twitch" }))
    }).pipe(Effect.scoped),
  )
})

/** A Notification as the receiver hands it over the RPC: encoded, under the message ID the test picks. */
const notification = (
  messageId: string,
  event: NotificationEvent,
  subscriptionId = "sub-online",
): NotificationEncoded => Schema.encodeSync(Notification)({ messageId, subscriptionId, event })

const online: NotificationEvent = { _tag: "StreamOnline" }

const offline: NotificationEvent = { _tag: "StreamOffline" }

/** A Redemption of the reward with the ID, which may or may not be the Reward's. */
const redemptionAdded = (rewardId: string): NotificationEvent => ({
  _tag: "RedemptionAdded",
  redemption: {
    id: "redemption-1",
    rewardId,
    viewerId: "viewer-1",
    viewerName: "viewer",
    input: "spotify:track:abc",
    redeemedAt: DateTime.makeUnsafe("2026-09-11T12:00:00Z"),
  },
})

/** The world with the Reward stored in the given pause state and known to Helix, so a pause update can answer. */
const worldWithReward = Effect.fnUntraced(function* (isPaused: boolean) {
  const world = yield* worldWithTwitch({ manageableRewards: [manageableSongRequest] })
  yield* world.channelStore.writeReward({ ...songRequestReward, isPaused })
  return world
})

describe("ChannelObject.receive", () => {
  it.effect("a stream online notification makes the Channel Live and unpauses the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(true)
      yield* world.channelStore.writeState("Offline")
      yield* world.channel.receive(notification("message-1", online))
      const requests = yield* rewardRequests(world)
      assert.deepStrictEqual(lines(requests), [
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      ])
      assert.deepStrictEqual(requests[0]?.json, { is_paused: false })
      assert.strictEqual(yield* world.channelStore.readState, "Live")
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ ...songRequestReward, isPaused: false }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("a stream offline notification makes the Channel Offline and pauses the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channelStore.writeState("Live")
      yield* world.channel.receive(notification("message-1", offline, "sub-offline"))
      const requests = yield* rewardRequests(world)
      assert.deepStrictEqual(
        requests.map((request) => request.json),
        [{ is_paused: true }],
      )
      assert.strictEqual(yield* world.channelStore.readState, "Offline")
      assert.deepStrictEqual(
        yield* world.channelStore.readReward,
        Option.some({ ...songRequestReward, isPaused: true }),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("a revocation records its reason on the stored Event Subscription", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channelStore.replaceEventSubscriptions(storedSubscriptions)
      yield* world.channel.receive(
        notification("message-1", { _tag: "Revocation", reason: "authorization_revoked" }),
      )
      const [redemption, revoked, offlineSubscription] =
        yield* world.channelStore.readEventSubscriptions
      assert.deepStrictEqual(revoked, {
        ...storedSubscriptions[1],
        status: "authorization_revoked",
        revocationReason: Option.some("authorization_revoked"),
      })
      assert.deepStrictEqual(redemption, storedSubscriptions[0])
      assert.deepStrictEqual(offlineSubscription, storedSubscriptions[2])
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect("acknowledges a repeated message ID without a second pause call", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channel.receive(notification("message-1", offline))
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 1)
    }).pipe(Effect.scoped),
  )

  it.effect("keeps a message ID for 24 hours and then forgets it", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      // A Connection that outlives the test, so no refresh gets in the way.
      yield* world.stores.twitch.writeConnection({
        ...twitchConnection,
        expiresAt: DateTime.makeUnsafe("2026-09-20T12:00:00Z"),
        nextRefreshAt: Option.some(DateTime.makeUnsafe("2026-09-20T11:55:00Z")),
      })
      yield* world.channel.receive(notification("message-1", offline))
      yield* TestClock.adjust("23 hours")
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 1)
      yield* TestClock.adjust("2 hours")
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 2)
    }).pipe(Effect.scoped),
  )

  it.effect("writes nothing for a Redemption of a reward that is not the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channel.receive(notification("message-1", redemptionAdded("reward-other")))
      assert.deepStrictEqual(yield* world.providers.received, [])
      assert.deepStrictEqual(yield* world.channelStore.readReward, Option.some(songRequestReward))
      // Not even the message ID was kept: the same ID still carries a later notification.
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 1)
    }).pipe(Effect.scoped),
  )

  it.effect("writes nothing for a revocation of an Event Subscription it does not hold", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channelStore.replaceEventSubscriptions(storedSubscriptions)
      yield* world.channel.receive(
        notification("message-1", { _tag: "Revocation", reason: "user_removed" }, "sub-unknown"),
      )
      assert.deepStrictEqual(yield* world.channelStore.readEventSubscriptions, storedSubscriptions)
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 1)
    }).pipe(Effect.scoped),
  )

  it.effect("still records the state when the pause update fails", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      // Helix knows no reward, so the pause update answers 404.
      yield* world.providers.twitchHelix.set(helixScenario())
      yield* world.channel.receive(notification("message-1", offline))
      assert.strictEqual(yield* world.channelStore.readState, "Offline")
      // The failure is logged and the notification acknowledged, not retried: reconcile repairs the pause state.
      yield* world.channel.receive(notification("message-1", offline))
      assert.lengthOf(yield* rewardRequests(world), 1)
    }).pipe(Effect.scoped),
  )
})
