import { assert, describe, it } from "@effect/vitest"
import { ConnectionNotConfigured } from "@twitch-integrations/domain/ConnectionErrors"
import {
  Notification,
  type NotificationEncoded,
  type NotificationEvent,
} from "@twitch-integrations/domain/Notification"
import type { ChatCommandEncoded } from "@twitch-integrations/domain/ChatCommand"
import { songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
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
import { HelixRequestFailed } from "../src/Helix.ts"
import type { ReceivedRequest } from "./FakeApi.ts"
import type { TwitchHelixScenario } from "./FakeProviders.ts"
import {
  authorizedConnection,
  chatCommandOf,
  heldRedemptionOf,
  manageableSongRequest,
  neverGonnaId,
  redemptionOf,
  songRequestReward,
  spotifyWithTracks,
  storedSubscriptions,
  twitchConnection,
  twitchConnectionWithChat,
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

/** The transport every created Event Subscription names: the receiver and the secret it signs with. */
const transport = {
  method: "webhook",
  callback: testTransport.callback,
  secret: testTransport.secret,
}

const asRecord = (json: unknown): Record<string, unknown> =>
  typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {}

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

  it.effect(
    "creates the chat Event Subscription too once the Twitch Connection carries the chat scopes",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithTwitch()
        yield* world.stores.twitch.writeConnection(twitchConnectionWithChat)
        yield* world.channel.reconcile()
        const requests = yield* subscriptionRequests(world)
        assert.deepStrictEqual(
          requests.slice(1).map((request) => request.json),
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
            {
              type: "channel.chat.message",
              version: "1",
              condition: { broadcaster_user_id: "twitch-user-1", user_id: "twitch-user-1" },
              transport,
            },
          ],
        )
        assert.deepStrictEqual(
          (yield* world.channelStore.readEventSubscriptions).map(
            (subscription) => subscription.type,
          ),
          [
            "channel.channel_points_custom_reward_redemption.add",
            "stream.online",
            "stream.offline",
            "channel.chat.message",
          ],
        )
      }).pipe(Effect.scoped),
  )

  it.effect("skips the chat Event Subscription while any chat scope is missing", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch()
      yield* world.stores.twitch.writeConnection({
        ...twitchConnectionWithChat,
        scopes: twitchConnectionWithChat.scopes.filter((scope) => scope !== "channel:bot"),
      })
      yield* world.channel.reconcile()
      const requests = yield* subscriptionRequests(world)
      assert.deepStrictEqual(
        requests.slice(1).map((request) => asRecord(request.json)["type"]),
        ["channel.channel_points_custom_reward_redemption.add", "stream.online", "stream.offline"],
      )
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

  it.effect("reports Twitch's reason when it refuses to create the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitch({
        rewardCreateRefusal: { status: 400, message: "CREATE_CUSTOM_REWARD_DUPLICATE_REWARD" },
      })
      const failure = yield* Effect.flip(world.channel.reconcile())
      assert.deepStrictEqual(
        failure,
        new HelixRequestFailed({
          operation: "create reward",
          reason: { _tag: "Status", status: 400 },
          detail: "CREATE_CUSTOM_REWARD_DUPLICATE_REWARD",
        }),
      )
      assert.deepStrictEqual(yield* world.channelStore.readReward, Option.none())
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

const redemptionAdded = (rewardId: string, input?: string, id?: string): NotificationEvent => ({
  _tag: "RedemptionAdded",
  redemption: redemptionOf(rewardId, input, id),
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

const spotifyQueueUrl = "https://api.spotify.com/v1/me/player/queue"

const spotifyTracksUrl = "https://api.spotify.com/v1/tracks"

const redemptionsUrl = "https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions"

const chatUrl = "https://api.twitch.tv/helix/chat/messages"

/** A track link as the viewer pastes it from Spotify's share menu, for the track with the ID. */
const trackLink = (trackId: string) => `https://open.spotify.com/track/${trackId}?si=share-token`

/**
 * The world Live with the Reward stored, both Connections authorized and
 * their tokens accepted, and Spotify knowing the tracks the tests request.
 */
const worldLiveWithSpotify = Effect.fnUntraced(function* (
  tracks?: Parameters<typeof spotifyWithTracks>[0],
) {
  const world = yield* worldWithReward(false)
  yield* world.channelStore.writeState("Live")
  yield* world.stores.spotify.writeConnection(authorizedConnection)
  yield* world.providers.spotifyWeb.set(spotifyWithTracks(tracks))
  return world
})

/** The queue adds Spotify received, by the URI each asked to queue. */
const queuedUris = (world: BroadcasterWorld) =>
  Effect.map(world.providers.spotifyWeb.received, (requests) =>
    requests
      .filter((request) => request.url.startsWith(spotifyQueueUrl))
      .map((request) => new URL(request.url).searchParams.get("uri")),
  )

describe("ChannelObject.receive of a Song Request", () => {
  it.effect("queues the track, fulfils the Redemption, and replies in chat, in that order", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.channel.receive(
        notification("message-1", redemptionAdded("reward-1", trackLink(neverGonnaId))),
      )
      yield* world.settled
      const requests = yield* world.providers.received
      assert.deepStrictEqual(lines(requests), [
        `POST ${spotifyQueueUrl}?uri=spotify%3Atrack%3A${neverGonnaId}`,
        `GET ${spotifyTracksUrl}/${neverGonnaId}`,
        `PATCH ${redemptionsUrl}?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-1`,
        `POST ${chatUrl}`,
      ])
      const [queued, lookedUp, fulfilled, chatted] = requests
      assert.strictEqual(queued?.headers["authorization"], "Bearer access-token-1")
      assert.strictEqual(lookedUp?.headers["authorization"], "Bearer access-token-1")
      assert.deepStrictEqual(fulfilled?.json, { status: "FULFILLED" })
      assert.strictEqual(fulfilled?.headers["authorization"], "Bearer access-token-1")
      assert.deepStrictEqual(chatted?.json, {
        broadcaster_id: "twitch-user-1",
        sender_id: "twitch-user-1",
        message: "@viewer added Never Gonna Give You Up by Rick Astley to the queue.",
      })
    }).pipe(Effect.scoped),
  )

  it.effect(
    "acknowledges before processing and processes a burst one at a time in arrival order",
    () =>
      Effect.gen(function* () {
        const tracks = [neverGonnaId, "7GhIk7Il098yCjg4BQjzvb", "0VjIjW4GlUZAMYd2vXMi3b"]
        const world = yield* worldLiveWithSpotify(
          Object.fromEntries(
            tracks.map((id) => [id, { name: `Track ${id}`, artists: ["Artist"] }]),
          ),
        )
        yield* Effect.forEach(tracks, (trackId, index) =>
          world.channel.receive(
            notification(
              `message-${index}`,
              redemptionAdded("reward-1", `spotify:track:${trackId}`, `redemption-${index}`),
            ),
          ),
        )
        // Every acknowledgement came back before any of the slow work started.
        assert.deepStrictEqual(yield* world.providers.received, [])
        yield* world.settled
        assert.deepStrictEqual(
          yield* queuedUris(world),
          tracks.map((trackId) => `spotify:track:${trackId}`),
        )
        // Each Redemption ran to its chat reply before the next was queued.
        const kinds = (yield* world.providers.received).map((request) =>
          request.url.startsWith(spotifyQueueUrl)
            ? "queue"
            : request.url === chatUrl
              ? "chat"
              : "other",
        )
        assert.deepStrictEqual(
          kinds.filter((kind) => kind !== "other"),
          ["queue", "chat", "queue", "chat", "queue", "chat"],
        )
      }).pipe(Effect.scoped),
  )

  it.effect("names the track by the link when the reply would pass 500 characters", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify({
        [neverGonnaId]: { name: "A".repeat(300), artists: ["B".repeat(300)] },
      })
      yield* world.channel.receive(
        notification("message-1", redemptionAdded("reward-1", `spotify:track:${neverGonnaId}`)),
      )
      yield* world.settled
      const chatted = (yield* world.providers.received).filter((request) => request.url === chatUrl)
      const [{ message }] = chatted.map((request) => request.json as { message: string })
      assert.isAtMost(message.length, 500)
      assert.match(message, /^@viewer added .* to the queue\.$/)
    }).pipe(Effect.scoped),
  )

  it.effect("drains a queue left over from before the object stopped when it starts", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.channelStore.enqueueRedemption(
        redemptionOf("reward-1", `spotify:track:${neverGonnaId}`),
      )
      yield* world.rebuildChannel
      yield* world.settled
      assert.deepStrictEqual(yield* queuedUris(world), [`spotify:track:${neverGonnaId}`])
    }).pipe(Effect.scoped),
  )

  it.effect("drains a queue left over from before the object stopped when it next receives", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.channelStore.enqueueRedemption(
        redemptionOf("reward-1", `spotify:track:${neverGonnaId}`),
      )
      yield* world.channel.receive(notification("message-1", online))
      yield* world.settled
      assert.deepStrictEqual(yield* queuedUris(world), [`spotify:track:${neverGonnaId}`])
    }).pipe(Effect.scoped),
  )
})

/** Every update of the Redemption's status Helix received. */
const redemptionUpdates = (world: BroadcasterWorld) =>
  Effect.map(helixRequests(world), (requests) =>
    requests.filter((request) => request.url.startsWith(redemptionsUrl)),
  )

const chatReplies = (world: BroadcasterWorld) =>
  Effect.map(helixRequests(world), (requests) =>
    requests.filter((request) => request.url === chatUrl),
  )

describe("ChannelObject.receive of a Song Request whose fulfil fails", () => {
  for (const recovery of ["notification", "reconcile", "already ended"] as const) {
    it.effect(`recovers fulfilment on ${recovery} without replaying Spotify`, () =>
      Effect.gen(function* () {
        const world = yield* worldLiveWithSpotify()
        yield* world.providers.twitchHelix.set(
          helixScenario({
            manageableRewards: [manageableSongRequest],
            redemptionUpdateRefusals: Infinity,
          }),
        )
        yield* world.channel.receive(
          notification("message-1", redemptionAdded("reward-1", trackLink(neverGonnaId))),
        )
        yield* TestClock.adjust("1500 millis")
        yield* world.settled
        // Another refusal retains the work, even during reconciliation.
        yield* world.channel.reconcile()
        assert.strictEqual((yield* world.channel.describe()).processing.total, 1)
        yield* world.providers.twitchHelix.set(
          helixScenario({
            manageableRewards: [manageableSongRequest],
            endedRedemptions: recovery === "already ended" ? ["redemption-1"] : [],
          }),
        )
        // A queued song must be fulfilled even if the stream has since ended.
        yield* world.channelStore.writeState("Offline")
        if (recovery === "notification") {
          yield* world.channel.receive(notification("message-1", redemptionAdded("reward-1")))
          yield* world.settled
        } else {
          yield* world.channel.reconcile()
        }
        assert.deepStrictEqual(yield* queuedUris(world), [`spotify:track:${neverGonnaId}`])
        assert.strictEqual((yield* world.channel.describe()).processing.total, 0)
        const attempts = yield* redemptionUpdates(world)
        assert.lengthOf(attempts, 6)
        assert.isTrue(
          attempts.every((request) => JSON.stringify(request.json) === '{"status":"FULFILLED"}'),
        )
        yield* world.rebuildChannel
        yield* world.settled
        assert.lengthOf(yield* redemptionUpdates(world), 6)
      }).pipe(Effect.scoped),
    )
  }

  it.effect("keeps a queued song for fulfilment after the short retries fail", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.providers.twitchHelix.set(
        helixScenario({
          manageableRewards: [manageableSongRequest],
          redemptionUpdateRefusals: Infinity,
        }),
      )
      yield* world.channel.receive(
        notification("message-1", redemptionAdded("reward-1", `spotify:track:${neverGonnaId}`)),
      )
      // The first attempt is made at once; each retry waits half a second.
      yield* TestClock.adjust("0 millis")
      assert.lengthOf(yield* redemptionUpdates(world), 1)
      yield* TestClock.adjust("499 millis")
      assert.lengthOf(yield* redemptionUpdates(world), 1)
      yield* TestClock.adjust("1 millis")
      assert.lengthOf(yield* redemptionUpdates(world), 2)
      yield* TestClock.adjust("500 millis")
      assert.lengthOf(yield* redemptionUpdates(world), 3)
      yield* TestClock.adjust("500 millis")
      yield* world.settled
      const attempts = yield* redemptionUpdates(world)
      assert.lengthOf(attempts, 4)
      assert.deepStrictEqual(
        new Set(attempts.map((request) => JSON.stringify(request.json))),
        new Set(['{"status":"FULFILLED"}']),
      )
      // Never cancelled: the viewer got their song. Nothing said in chat either.
      assert.deepStrictEqual(yield* chatReplies(world), [])
      assert.strictEqual((yield* world.channel.describe()).processing.total, 1)
      yield* world.providers.twitchHelix.set(
        helixScenario({ manageableRewards: [manageableSongRequest] }),
      )
      yield* world.rebuildChannel
      yield* world.settled
      assert.lengthOf(yield* redemptionUpdates(world), 5)
      assert.deepStrictEqual(yield* queuedUris(world), [`spotify:track:${neverGonnaId}`])
      assert.strictEqual((yield* world.channel.describe()).processing.total, 0)
    }).pipe(Effect.scoped),
  )

  it.effect("fulfils and replies once a retry succeeds", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.providers.twitchHelix.set(
        helixScenario({ manageableRewards: [manageableSongRequest], redemptionUpdateRefusals: 1 }),
      )
      yield* world.channel.receive(
        notification("message-1", redemptionAdded("reward-1", `spotify:track:${neverGonnaId}`)),
      )
      yield* TestClock.adjust("500 millis")
      yield* world.settled
      assert.lengthOf(yield* redemptionUpdates(world), 2)
      const [reply] = yield* chatReplies(world)
      assert.deepStrictEqual(reply?.json, {
        broadcaster_id: "twitch-user-1",
        sender_id: "twitch-user-1",
        message: "@viewer added Never Gonna Give You Up by Rick Astley to the queue.",
      })
    }).pipe(Effect.scoped),
  )
})

/** The world with the Reward stored and the Twitch Connection Reauthorization Required, so no cancel can reach Twitch. */
const worldWithTwitchDisconnected = Effect.fnUntraced(function* () {
  const world = yield* worldWithReward(false)
  yield* world.stores.twitch.writeConnection({
    ...twitchConnection,
    status: "Reauthorization Required",
  })
  return world
})

describe("ChannelObject.receive of a Song Request while Twitch is disconnected", () => {
  it.effect("holds each Redemption it cannot cancel and goes on with the next", () =>
    Effect.gen(function* () {
      const world = yield* worldWithTwitchDisconnected()
      // Offline, so each Redemption is cancelled without a Spotify call.
      yield* world.channel.receive(
        notification("message-1", redemptionAdded("reward-1", "not a link", "redemption-1")),
      )
      yield* world.channel.receive(
        notification("message-2", redemptionAdded("reward-1", "still not", "redemption-2")),
      )
      yield* world.settled
      assert.deepStrictEqual(yield* world.providers.received, [])
      assert.deepStrictEqual(yield* world.channelStore.readHeldRedemptions, [
        heldRedemptionOf("redemption-1", "not a link"),
        heldRedemptionOf("redemption-2", "still not"),
      ])
      // Both left the Processing Queue: a restart processes nothing again.
      yield* world.rebuildChannel
      yield* world.settled
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )
})

/** The world with two Redemptions held while Twitch had no Connection, and Twitch since reconnected. */
const worldWithHeldRedemptions = Effect.fnUntraced(function* () {
  const world = yield* makeBroadcasterWorld
  yield* at("2026-09-11T12:00:00Z")
  yield* world.channelStore.writeReward(songRequestReward)
  yield* world.channel.receive(
    notification("message-1", redemptionAdded("reward-1", "not a link", "redemption-1")),
  )
  yield* world.channel.receive(
    notification("message-2", redemptionAdded("reward-1", "still not", "redemption-2")),
  )
  yield* world.settled
  yield* world.stores.twitch.writeConnection(twitchConnection)
  yield* world.providers.twitchHelix.set(
    helixScenario({ manageableRewards: [manageableSongRequest] }),
  )
  return world
})

describe("ChannelObject.reconcile with held Redemptions", () => {
  it.effect("cancels every held Redemption in arrival order before touching the Reward", () =>
    Effect.gen(function* () {
      const world = yield* worldWithHeldRedemptions()
      assert.lengthOf(yield* world.channelStore.readHeldRedemptions, 2)
      yield* world.channel.reconcile()
      const requests = yield* helixRequests(world)
      assert.deepStrictEqual(lines(requests.slice(0, 3)), [
        `PATCH ${redemptionsUrl}?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-1`,
        `PATCH ${redemptionsUrl}?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-2`,
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      ])
      assert.deepStrictEqual(
        requests.slice(0, 2).map((request) => request.json),
        [{ status: "CANCELED" }, { status: "CANCELED" }],
      )
      assert.deepStrictEqual(yield* world.channelStore.readHeldRedemptions, [])
      // Settled once: the next reconcile has nothing to cancel.
      yield* world.channel.reconcile()
      assert.lengthOf(yield* redemptionUpdates(world), 2)
    }).pipe(Effect.scoped),
  )
})

describe("ChannelObject.reconcile with a held Redemption Twitch has already ended", () => {
  it.effect("drops it without retrying and settles the rest", () =>
    Effect.gen(function* () {
      const world = yield* worldWithHeldRedemptions()
      yield* world.providers.twitchHelix.set(
        helixScenario({
          manageableRewards: [manageableSongRequest],
          endedRedemptions: ["redemption-1"],
        }),
      )
      yield* world.channel.reconcile()
      assert.deepStrictEqual(lines(yield* redemptionUpdates(world)), [
        `PATCH ${redemptionsUrl}?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-1`,
        `PATCH ${redemptionsUrl}?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-2`,
      ])
      assert.deepStrictEqual(yield* world.channelStore.readHeldRedemptions, [])
      // The reconcile went on to the Reward.
      assert.include(
        lines(yield* rewardRequests(world)),
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      )
      yield* world.channel.reconcile()
      assert.lengthOf(yield* redemptionUpdates(world), 2)
    }).pipe(Effect.scoped),
  )
})

describe("ChannelObject.reconcile with a held Redemption Twitch refuses to cancel", () => {
  it.effect("keeps it held and still brings the rest of the channel in line", () =>
    Effect.gen(function* () {
      const world = yield* worldWithHeldRedemptions()
      yield* world.providers.twitchHelix.set(
        helixScenario({
          manageableRewards: [manageableSongRequest],
          redemptionUpdateRefusals: Infinity,
        }),
      )
      yield* world.channel.reconcile()
      assert.lengthOf(yield* redemptionUpdates(world), 2)
      assert.deepStrictEqual(yield* world.channelStore.readHeldRedemptions, [
        heldRedemptionOf("redemption-1", "not a link"),
        heldRedemptionOf("redemption-2", "still not"),
      ])
      assert.include(
        lines(yield* rewardRequests(world)),
        `PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`,
      )
      // Still held: the next reconcile tries again.
      yield* world.channel.reconcile()
      assert.lengthOf(yield* redemptionUpdates(world), 4)
    }).pipe(Effect.scoped),
  )
})

describe("ChannelObject chat commands", () => {
  const noon = DateTime.makeUnsafe("2026-09-11T12:00:00Z")

  const chatCommands = (world: BroadcasterWorld) =>
    Effect.map(world.channel.describe(), (snapshot) => snapshot.chatCommands)

  it.effect("creates a Chat Command that starts Enabled with a ten second Cooldown", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      const created = yield* world.channel.createChatCommand({
        name: "today",
        response: "Building the Chat Commands feature",
      })
      const expected: ChatCommandEncoded = {
        name: "today",
        response: "Building the Chat Commands feature",
        status: "Enabled",
        cooldown: 10_000,
        cooldownUntil: null,
        lastAnsweredAt: null,
      }
      assert.deepStrictEqual(created, expected)
      assert.deepStrictEqual(yield* chatCommands(world), [expected])
    }).pipe(Effect.scoped),
  )

  it.effect("rejects a second Chat Command whose name differs only by case", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      yield* world.channel.createChatCommand({ name: "today", response: "one" })
      const rejection = yield* Effect.flip(
        world.channel.createChatCommand({ name: "Today", response: "two" }),
      )
      assert.strictEqual(rejection._tag, "DuplicateChatCommand")
      assert.deepStrictEqual(
        (yield* chatCommands(world)).map((command) => command.response),
        ["one"],
      )
    }).pipe(Effect.scoped),
  )

  it.effect("rejects a draft the schema refuses without storing anything", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      const rejection = yield* Effect.flip(
        world.channel.createChatCommand({ name: "to day", response: "x" }),
      )
      assert.strictEqual(rejection._tag, "InvalidChatCommandDraft")
      yield* world.channel.createChatCommand({ name: "today", response: "x" })
      const edit = yield* Effect.flip(
        world.channel.updateChatCommand("today", {
          response: "y".repeat(501),
          cooldown: 10_000,
          status: "Enabled",
        }),
      )
      assert.strictEqual(edit._tag, "InvalidChatCommandDraft")
      assert.deepStrictEqual(
        (yield* chatCommands(world)).map((command) => command.response),
        ["x"],
      )
    }).pipe(Effect.scoped),
  )

  it.effect("rejects editing or deleting a name it does not hold", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      const edit = yield* Effect.flip(
        world.channel.updateChatCommand("today", {
          response: "x",
          cooldown: 10_000,
          status: "Enabled",
        }),
      )
      assert.deepStrictEqual([edit._tag, edit.name], ["UnknownChatCommand", "today"])
      const deletion = yield* Effect.flip(world.channel.deleteChatCommand("today"))
      assert.deepStrictEqual([deletion._tag, deletion.name], ["UnknownChatCommand", "today"])
    }).pipe(Effect.scoped),
  )

  it.effect("clears a running Cooldown on edit and keeps when it last answered", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      yield* at("2026-09-11T12:00:05Z")
      yield* world.channelStore.writeChatCommand({
        ...chatCommandOf("today", "old"),
        cooldownUntil: Option.some(DateTime.addDuration(noon, Duration.seconds(10))),
        lastAnsweredAt: Option.some(noon),
      })
      const edited = yield* world.channel.updateChatCommand("today", {
        response: "new",
        cooldown: 30_000,
        status: "Enabled",
      })
      const expected: ChatCommandEncoded = {
        name: "today",
        response: "new",
        status: "Enabled",
        cooldown: 30_000,
        cooldownUntil: null,
        lastAnsweredAt: "2026-09-11T12:00:00.000Z",
      }
      assert.deepStrictEqual(edited, expected)
      assert.deepStrictEqual(yield* chatCommands(world), [expected])
    }).pipe(Effect.scoped),
  )

  it.effect("treats enabling a Disabled Chat Command as an edit that ends its Cooldown", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      yield* at("2026-09-11T12:00:05Z")
      yield* world.channelStore.writeChatCommand({
        ...chatCommandOf("today"),
        status: "Disabled",
        cooldownUntil: Option.some(DateTime.addDuration(noon, Duration.seconds(10))),
        lastAnsweredAt: Option.some(noon),
      })
      yield* world.channel.updateChatCommand("today", {
        response: "the today response",
        cooldown: 10_000,
        status: "Enabled",
      })
      assert.deepStrictEqual(yield* chatCommands(world), [
        {
          name: "today",
          response: "the today response",
          status: "Enabled",
          cooldown: 10_000,
          cooldownUntil: null,
          lastAnsweredAt: "2026-09-11T12:00:00.000Z",
        },
      ])
    }).pipe(Effect.scoped),
  )

  it.effect("deletes a Chat Command by any casing of its name", () =>
    Effect.gen(function* () {
      const world = yield* makeWorld()
      yield* world.channel.createChatCommand({ name: "today", response: "x" })
      yield* world.channel.createChatCommand({ name: "discord", response: "y" })
      yield* world.channel.deleteChatCommand("TODAY")
      assert.deepStrictEqual(
        (yield* chatCommands(world)).map((command) => command.name),
        ["discord"],
      )
    }).pipe(Effect.scoped),
  )
})
