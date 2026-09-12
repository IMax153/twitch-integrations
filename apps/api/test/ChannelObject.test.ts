import { assert, describe, it } from "@effect/vitest"
import { ConnectionNotConfigured } from "@twitch-integrations/domain/ConnectionErrors"
import { songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
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
import { songRequestReward, twitchConnection } from "./fixtures.ts"

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

/** The Song Request Reward as Helix holds it, already manageable by this client ID. */
const manageableSongRequest = {
  id: "reward-1",
  title: "Song Request",
  cost: 1,
  prompt: songRequestSettings.prompt,
  is_paused: false,
}

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
