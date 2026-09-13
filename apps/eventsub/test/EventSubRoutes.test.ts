import { assert, describe, it } from "@effect/vitest"
import { songRequestSettings } from "@twitch-integrations/domain/Reward"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as TestClock from "effect/testing/TestClock"
import { testTransport } from "../../api/test/BroadcasterHarness.ts"
import {
  authorizedConnection,
  chatCommandOf,
  manageableSongRequest,
  neverGonnaId,
  songRequestReward,
  spotifyWithTracks,
  storedSubscriptions,
  twitchConnection,
} from "../../api/test/fixtures.ts"
import type { ReceivedRequest } from "../../api/test/FakeApi.ts"
import type { SpotifyWebScenario, TwitchHelixScenario } from "../../api/test/FakeProviders.ts"
import { type ReceiverWorld, makeReceiverWorld } from "./ReceiverHarness.ts"
import { createHmac } from "node:crypto"

/** The secret the receiver is configured with; the tests sign with the same value. */
const { secret } = testTransport

const origin = "https://stream.example"

/** The receiver over a fresh world, answering one Web request; for the rules that never reach the Channel. */
const send = Effect.fnUntraced(function* (request: Request) {
  const world = yield* makeReceiverWorld
  return yield* world.receive(request)
}, Effect.scoped)

/** The webhook path Twitch delivers to. */
const webhookPath = "/eventsub/twitch"

/**
 * A body the handler must never read: the stream records whether anything
 * pulled from it, and the request claims a size the receiver refuses.
 */
const unreadBody = (declaredLength: number) => {
  let pulled = false
  // A high-water mark of zero stops the stream prefetching a chunk on its
  // own, so a pull can only come from something reading the body.
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        pulled = true
        controller.enqueue(new TextEncoder().encode("x".repeat(1024)))
      },
    },
    { highWaterMark: 0 },
  )
  const request = new Request(`${origin}${webhookPath}`, {
    method: "POST",
    body: stream,
    duplex: "half",
    headers: { "content-length": String(declaredLength) },
  } as RequestInit)
  return { request, wasPulled: () => pulled }
}

/** Twitch's headers on every webhook message. */
interface MessageHeaders {
  readonly id: string
  readonly timestamp: string
  readonly type: string
  readonly signature: string
}

/** A message the test sends as Twitch, before it is signed. */
interface OutgoingMessage {
  readonly type: string
  readonly body: string
  /** Headers to send instead of the ones the message would carry; `undefined` omits one. */
  readonly headers?: Partial<Record<keyof MessageHeaders, string | undefined>>
  /** How long before the receiver's clock the message was sent. */
  readonly age?: Duration.Input
}

/** Twitch's signature: the hex HMAC-SHA256 over message ID, timestamp, and raw body, with its algorithm prefix. */
const sign = (key: string, id: string, timestamp: string, body: string): string =>
  `sha256=${createHmac("sha256", key).update(`${id}${timestamp}${body}`).digest("hex")}`

const headerNames: Record<keyof MessageHeaders, string> = {
  id: "Twitch-Eventsub-Message-Id",
  timestamp: "Twitch-Eventsub-Message-Timestamp",
  type: "Twitch-Eventsub-Message-Type",
  signature: "Twitch-Eventsub-Message-Signature",
}

let nextMessageId = 0

/** A webhook message as Twitch would send it, signed with the configured secret, dated by the test clock. */
const signedRequest = Effect.fnUntraced(function* (message: OutgoingMessage) {
  const now = yield* DateTime.now
  const sentAt = message.age === undefined ? now : DateTime.subtractDuration(now, message.age)
  nextMessageId += 1
  const id = message.headers?.id ?? `message-${nextMessageId}`
  const timestamp = message.headers?.timestamp ?? DateTime.formatIso(sentAt)
  // The signature covers whatever ID and timestamp are actually sent, so an
  // override of either still arrives correctly signed unless the test says otherwise.
  const carried: Record<keyof MessageHeaders, string | undefined> = {
    id,
    timestamp,
    type: message.type,
    signature: sign(secret, id, timestamp, message.body),
    ...message.headers,
  }
  const headers = new Headers({ "content-type": "application/json" })
  for (const [name, value] of Object.entries(carried)) {
    if (value !== undefined) {
      headers.set(headerNames[name as keyof MessageHeaders], value)
    }
  }
  return new Request(`${origin}${webhookPath}`, { method: "POST", headers, body: message.body })
})

/** A stream notification's body as Twitch sends it, from the subscription with the ID and type. */
const streamBody = (subscriptionId: string, type: "stream.online" | "stream.offline") =>
  JSON.stringify({
    subscription: {
      id: subscriptionId,
      type,
      version: "1",
      status: "enabled",
      cost: 0,
      condition: { broadcaster_user_id: "twitch-user-1" },
      transport: { method: "webhook", callback: testTransport.callback },
      created_at: "2026-09-11T11:00:00Z",
    },
    event: {
      id: "9001",
      broadcaster_user_id: "twitch-user-1",
      broadcaster_user_login: "max",
      broadcaster_user_name: "max",
      ...(type === "stream.online" ? { type: "live", started_at: "2026-09-11T12:00:00Z" } : {}),
    },
  })

/** A redemption add notification's body, for the reward with the ID, with the input the viewer typed. */
const redemptionBody = (rewardId: string, input = "spotify:track:abc") =>
  JSON.stringify({
    subscription: {
      id: "sub-redemption",
      type: "channel.channel_points_custom_reward_redemption.add",
      version: "1",
      status: "enabled",
      cost: 0,
      condition: { broadcaster_user_id: "twitch-user-1", reward_id: rewardId },
      transport: { method: "webhook", callback: testTransport.callback },
      created_at: "2026-09-11T11:00:00Z",
    },
    event: {
      id: "redemption-1",
      broadcaster_user_id: "twitch-user-1",
      broadcaster_user_login: "max",
      broadcaster_user_name: "max",
      user_id: "viewer-1",
      user_login: "viewer",
      user_name: "Viewer",
      user_input: input,
      status: "unfulfilled",
      reward: { id: rewardId, title: "Song Request", cost: 1, prompt: songRequestSettings.prompt },
      redeemed_at: "2026-09-11T12:00:03.17106713Z",
    },
  })

/** How a chat message differs from a viewer typing in the Broadcaster's own chat. */
interface ChatMessageOptions {
  /** The chatter, the viewer unless the test says otherwise. */
  readonly chatter?: { readonly id: string; readonly login: string; readonly name: string }
  /** The channel the line was typed in during shared chat; null outside one. */
  readonly sourceBroadcasterId?: string | null
}

const viewer = { id: "viewer-1", login: "viewer", name: "Viewer" }

/** A chat message notification's body as Twitch sends it, with the text the chatter typed. */
const chatBody = (text: string, options: ChatMessageOptions = {}) => {
  const chatter = options.chatter ?? viewer
  return JSON.stringify({
    subscription: {
      id: "sub-chat",
      type: "channel.chat.message",
      version: "1",
      status: "enabled",
      cost: 0,
      condition: { broadcaster_user_id: "twitch-user-1", user_id: "twitch-user-1" },
      transport: { method: "webhook", callback: testTransport.callback },
      created_at: "2026-09-11T11:00:00Z",
    },
    event: {
      broadcaster_user_id: "twitch-user-1",
      broadcaster_user_login: "max",
      broadcaster_user_name: "max",
      source_broadcaster_user_id: options.sourceBroadcasterId ?? null,
      source_broadcaster_user_login: null,
      source_broadcaster_user_name: null,
      chatter_user_id: chatter.id,
      chatter_user_login: chatter.login,
      chatter_user_name: chatter.name,
      message_id: "chat-msg-1",
      source_message_id: null,
      is_source_only: null,
      message: {
        text,
        fragments: [{ type: "text", text, cheermote: null, emote: null, mention: null }],
      },
      color: "#FF0000",
      badges: [],
      source_badges: null,
      message_type: "text",
      cheer: null,
      reply: null,
      channel_points_custom_reward_id: null,
      channel_points_animation_id: null,
    },
  })
}

/** A revocation's body: the subscription with the reason as its status. */
const revocationBody = (subscriptionId: string, reason: string) =>
  JSON.stringify({
    subscription: {
      id: subscriptionId,
      status: reason,
      type: "stream.online",
      version: "1",
      cost: 0,
      condition: { broadcaster_user_id: "twitch-user-1" },
      transport: { method: "webhook", callback: testTransport.callback },
      created_at: "2026-09-11T11:00:00Z",
    },
  })

const rewardsUrl = "https://api.twitch.tv/helix/channel_points/custom_rewards"

/** Helix as the tests start it: accepting the stored Connection's token and knowing the Reward. */
const helixScenario: TwitchHelixScenario = {
  accessToken: Option.some("access-token-1"),
  manageableRewards: [manageableSongRequest],
}

/** The world at noon with Twitch authorized, its Reward stored in the given pause state, and Helix knowing it. */
const worldWithReward = Effect.fnUntraced(function* (isPaused: boolean) {
  const world = yield* makeReceiverWorld
  yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-11T12:00:00Z")))
  yield* world.stores.twitch.writeConnection(twitchConnection)
  yield* world.providers.twitchHelix.set({
    ...helixScenario,
    manageableRewards: [{ ...manageableSongRequest, is_paused: isPaused }],
  })
  yield* world.channelStore.writeReward({ ...songRequestReward, isPaused })
  yield* world.channelStore.replaceEventSubscriptions(storedSubscriptions)
  return world
})

/** The world Live with Spotify authorized too, and the Spotify Web API answering as the scenario says. */
const worldLiveWithSpotify = Effect.fnUntraced(function* (
  spotify: SpotifyWebScenario = spotifyWithTracks(),
) {
  const world = yield* worldWithReward(false)
  yield* world.channelStore.writeState("Live")
  yield* world.stores.spotify.writeConnection(authorizedConnection)
  yield* world.providers.spotifyWeb.set(spotify)
  return world
})

const redemptionsUrl = `${rewardsUrl}/redemptions?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-1`

const chatUrl = "https://api.twitch.tv/helix/chat/messages"

const line = (request: ReceivedRequest) => `${request.method} ${request.url}`

/** Sends a Song Request with the input as Twitch would, and returns every request the fakes saw once the Channel is done with it. */
const songRequest = Effect.fnUntraced(function* (world: ReceiverWorld, input: string) {
  const request = yield* signedRequest({
    type: "notification",
    body: redemptionBody("reward-1", input),
  })
  yield* assertAccepted(yield* world.receive(request))
  yield* world.settled
  return yield* world.providers.received
})

/** The chat message as Twitch received it: sent as the Twitch Connected Account to its own chat. */
const chatMessage = (message: string) => ({
  broadcaster_id: "twitch-user-1",
  sender_id: "twitch-user-1",
  message,
})

const spotifyRequests = (requests: ReadonlyArray<ReceivedRequest>) =>
  requests.filter((request) => request.hostname === "api.spotify.com")

/** Asserts Twitch was asked exactly to cancel the Redemption and then to tell the viewer why. */
const assertCancelled = (requests: ReadonlyArray<ReceivedRequest>, reply: string) => {
  const twitch = requests.filter((request) => request.hostname === "api.twitch.tv")
  assert.deepStrictEqual(twitch.map(line), [`PATCH ${redemptionsUrl}`, `POST ${chatUrl}`])
  assert.deepStrictEqual(twitch[0]?.json, { status: "CANCELED" })
  assert.deepStrictEqual(twitch[1]?.json, chatMessage(`@Viewer ${reply}`))
}

/** The pause updates Helix received, as `PATCH` lines with their bodies; a Redemption update is not one. */
const pauseUpdates = (world: ReceiverWorld) =>
  Effect.map(world.providers.twitchHelix.received, (requests) =>
    requests
      .filter((request) => request.url.startsWith(`${rewardsUrl}?`))
      .map((request) => [line(request), request.json]),
  )

const assertAccepted = Effect.fnUntraced(function* (response: Response) {
  assert.strictEqual(response.status, 204)
  assert.strictEqual(yield* Effect.promise(() => response.text()), "")
})

const challengeBody = (challenge: string) =>
  JSON.stringify({
    challenge,
    subscription: { id: "sub-1", status: "webhook_callback_verification_pending" },
  })

const assertEmpty = Effect.fnUntraced(function* (response: Response, status: number) {
  assert.strictEqual(response.status, status)
  assert.strictEqual(yield* Effect.promise(() => response.text()), "")
})

describe("the receiver", () => {
  const unroutable: ReadonlyArray<[string, string]> = [
    ["GET", "/eventsub/twitch"],
    ["POST", "/eventsub/other"],
    ["POST", "/eventsub"],
    ["GET", "/"],
  ]

  for (const [method, path] of unroutable) {
    it.effect(`answers ${method} ${path} with an empty 404`, () =>
      Effect.gen(function* () {
        const response = yield* send(new Request(`${origin}${path}`, { method }))
        yield* assertEmpty(response, 404)
      }),
    )
  }

  it.effect("refuses a body declared larger than 64 KB with 413 before reading it", () =>
    Effect.gen(function* () {
      const { request, wasPulled } = unreadBody(64 * 1024 + 1)
      const response = yield* send(request)
      yield* assertEmpty(response, 413)
      assert.isFalse(wasPulled())
    }),
  )

  it.effect("refuses a body over 64 KB that declared no length once it is read", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "notification",
        body: "x".repeat(64 * 1024 + 1),
      })
      assert.isNull(request.headers.get("content-length"))
      yield* assertEmpty(yield* send(request), 413)
    }),
  )

  it.effect("refuses a message with no signature", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body: challengeBody("hello"),
        headers: { signature: undefined },
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect("refuses a message with no timestamp", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body: challengeBody("hello"),
        headers: { timestamp: undefined },
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect("refuses a correct digest that lacks Twitch's algorithm prefix", () =>
    Effect.gen(function* () {
      const body = challengeBody("hello")
      const id = "message-unprefixed"
      const timestamp = DateTime.formatIso(yield* DateTime.now)
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body,
        headers: {
          id,
          timestamp,
          signature: sign(secret, id, timestamp, body).slice("sha256=".length),
        },
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect("refuses a message signed with another secret", () =>
    Effect.gen(function* () {
      const body = challengeBody("hello")
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body,
        headers: {
          signature: sign("not-the-configured-secret", "message-x", "2026-01-01T00:00:00Z", body),
        },
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect("answers a callback verification with the raw challenge as text", () =>
    Effect.gen(function* () {
      // Characters JSON would escape, to show the challenge is not re-encoded.
      const challenge = 'pogchamp-"kappa"-<&>-1234'
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body: challengeBody(challenge),
      })
      const response = yield* send(request)
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^text\/plain/)
      assert.strictEqual(yield* Effect.promise(() => response.text()), challenge)
    }),
  )

  it.effect("refuses a correctly signed message older than ten minutes", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body: challengeBody("late"),
        age: "11 minutes",
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect("refuses a correctly signed message whose timestamp is not a date", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "webhook_callback_verification",
        body: challengeBody("odd"),
        headers: { timestamp: "yesterday" },
      })
      yield* assertEmpty(yield* send(request), 403)
    }),
  )

  it.effect(
    "acknowledges a correctly signed notification of an unknown type without reaching the Channel",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithReward(false)
        const body = JSON.stringify({
          subscription: { id: "sub-1", type: "channel.update", version: "2" },
          event: { broadcaster_user_id: "twitch-user-1", title: "new title" },
        })
        yield* assertAccepted(
          yield* world.receive(yield* signedRequest({ type: "notification", body })),
        )
        assert.deepStrictEqual(yield* world.providers.received, [])
        assert.strictEqual(yield* world.channelStore.readState, "Offline")
      }).pipe(Effect.scoped),
  )
})

describe("the receiver and the Channel", () => {
  it.effect("a stream online notification unpauses the Reward on Twitch", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(true)
      const request = yield* signedRequest({
        type: "notification",
        body: streamBody("sub-online", "stream.online"),
      })
      yield* assertAccepted(yield* world.receive(request))
      assert.deepStrictEqual(yield* pauseUpdates(world), [
        [`PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`, { is_paused: false }],
      ])
      assert.strictEqual(yield* world.channelStore.readState, "Live")
    }).pipe(Effect.scoped),
  )

  it.effect("a stream offline notification pauses the Reward on Twitch", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channelStore.writeState("Live")
      const request = yield* signedRequest({
        type: "notification",
        body: streamBody("sub-offline", "stream.offline"),
      })
      yield* assertAccepted(yield* world.receive(request))
      assert.deepStrictEqual(yield* pauseUpdates(world), [
        [`PATCH ${rewardsUrl}?broadcaster_id=twitch-user-1&id=reward-1`, { is_paused: true }],
      ])
      assert.strictEqual(yield* world.channelStore.readState, "Offline")
    }).pipe(Effect.scoped),
  )

  it.effect("a revocation records its reason on the Event Subscription", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      const request = yield* signedRequest({
        type: "revocation",
        body: revocationBody("sub-online", "authorization_revoked"),
      })
      yield* assertAccepted(yield* world.receive(request))
      const subscriptions = yield* world.channelStore.readEventSubscriptions
      assert.deepStrictEqual(subscriptions[1], {
        ...storedSubscriptions[1],
        status: "authorization_revoked",
        revocationReason: Option.some("authorization_revoked"),
      })
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect(
    "a notification Twitch resends with the same message ID is acknowledged and not processed again",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithReward(false)
        const body = streamBody("sub-offline", "stream.offline")
        const first = yield* signedRequest({
          type: "notification",
          body,
          headers: { id: "message-resent" },
        })
        yield* assertAccepted(yield* world.receive(first))
        const again = yield* signedRequest({
          type: "notification",
          body,
          headers: { id: "message-resent" },
        })
        yield* assertAccepted(yield* world.receive(again))
        assert.lengthOf(yield* pauseUpdates(world), 1)
      }).pipe(Effect.scoped),
  )

  it.effect(
    "a Redemption of the Reward reaches the Channel and one of another reward is dropped",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithReward(false)
        const other = yield* signedRequest({
          type: "notification",
          body: redemptionBody("reward-other"),
          headers: { id: "message-shared" },
        })
        yield* assertAccepted(yield* world.receive(other))
        // Nothing was kept of the dropped one, not even its message ID.
        const ours = yield* signedRequest({
          type: "notification",
          body: redemptionBody("reward-1"),
          headers: { id: "message-shared" },
        })
        yield* assertAccepted(yield* world.receive(ours))
        // Once processed, the same ID is a resend, so an offline notification under it changes nothing.
        const resend = yield* signedRequest({
          type: "notification",
          body: streamBody("sub-offline", "stream.offline"),
          headers: { id: "message-shared" },
        })
        yield* assertAccepted(yield* world.receive(resend))
        assert.deepStrictEqual(yield* pauseUpdates(world), [])
        assert.strictEqual(yield* world.channelStore.readState, "Offline")
      }).pipe(Effect.scoped),
  )

  it.effect("a notification whose body is not its type's event is acknowledged and dropped", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      const body = JSON.stringify({
        subscription: {
          id: "sub-redemption",
          type: "channel.channel_points_custom_reward_redemption.add",
        },
        event: { id: "redemption-1" },
      })
      yield* assertAccepted(
        yield* world.receive(yield* signedRequest({ type: "notification", body })),
      )
      assert.deepStrictEqual(yield* world.providers.received, [])
    }).pipe(Effect.scoped),
  )

  it.effect(
    "a Song Request while Live queues the track, fulfils, and replies before anything else",
    () =>
      Effect.gen(function* () {
        const world = yield* worldLiveWithSpotify()
        const request = yield* signedRequest({
          type: "notification",
          body: redemptionBody(
            "reward-1",
            `https://open.spotify.com/track/${neverGonnaId}?si=share-token`,
          ),
        })
        yield* assertAccepted(yield* world.receive(request))
        // Acknowledged first: the slow work had not started when Twitch got its answer.
        assert.deepStrictEqual(yield* world.providers.received, [])
        yield* world.settled
        const requests = yield* world.providers.received
        assert.deepStrictEqual(
          requests.map((received) => `${received.method} ${received.url}`),
          [
            `POST https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3A${neverGonnaId}`,
            `GET https://api.spotify.com/v1/tracks/${neverGonnaId}`,
            `PATCH ${rewardsUrl}/redemptions?broadcaster_id=twitch-user-1&reward_id=reward-1&id=redemption-1`,
            "POST https://api.twitch.tv/helix/chat/messages",
          ],
        )
        assert.deepStrictEqual(requests[2]?.json, { status: "FULFILLED" })
        assert.deepStrictEqual(requests[3]?.json, {
          broadcaster_id: "twitch-user-1",
          sender_id: "twitch-user-1",
          message: "@Viewer added Never Gonna Give You Up by Rick Astley to the queue.",
        })
      }).pipe(Effect.scoped),
  )
})

/** The world Offline with Twitch authorized and one Enabled Chat Command, `!today`, that has never answered. */
const worldWithChatCommand = Effect.fnUntraced(function* () {
  const world = yield* worldWithReward(false)
  yield* world.channelStore.writeChatCommand(chatCommandOf("today", "Building Chat Commands"))
  return world
})

/** Sends the chat line as Twitch would and asserts the receiver acknowledged it. */
const chat = Effect.fnUntraced(function* (
  world: ReceiverWorld,
  text: string,
  options: ChatMessageOptions & { readonly messageId?: string } = {},
) {
  const request = yield* signedRequest({
    type: "notification",
    body: chatBody(text, options),
    ...(options.messageId === undefined ? {} : { headers: { id: options.messageId } }),
  })
  yield* assertAccepted(yield* world.receive(request))
})

/** The chat messages Helix was asked to send, as their bodies. */
const chatSends = (world: ReceiverWorld) =>
  Effect.map(world.providers.twitchHelix.received, (requests) =>
    requests.filter((request) => request.url === chatUrl).map((request) => request.json),
  )

/** The `!today` reply as Twitch receives it: threaded under the invoking message. */
const todayReply = {
  ...chatMessage("Building Chat Commands"),
  reply_parent_message_id: "chat-msg-1",
}

/** What the `!today` Chat Command remembers, as the page reads it. */
const todayTimes = (world: ReceiverWorld) =>
  Effect.map(world.channel.describe(), ({ chatCommands }) => ({
    cooldownUntil: chatCommands[0]?.cooldownUntil,
    lastAnsweredAt: chatCommands[0]?.lastAnsweredAt,
  }))

describe("the receiver and a Chat Command", () => {
  it.effect(
    "an exact Invocation while Offline is answered in a thread and starts the Cooldown",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithChatCommand()
        yield* chat(world, "!today")
        assert.deepStrictEqual(yield* chatSends(world), [todayReply])
        assert.deepStrictEqual(yield* todayTimes(world), {
          cooldownUntil: "2026-09-11T12:00:10.000Z",
          lastAnsweredAt: "2026-09-11T12:00:00.000Z",
        })
      }).pipe(Effect.scoped),
  )

  it.effect("the Broadcaster's own Invocation is answered", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* chat(world, "  !today ", {
        chatter: { id: "twitch-user-1", login: "max", name: "max" },
      })
      assert.deepStrictEqual(yield* chatSends(world), [todayReply])
    }).pipe(Effect.scoped),
  )

  it.effect("a line that is not exactly the name is ignored and stores nothing", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* chat(world, "!Today", { messageId: "message-case" })
      yield* chat(world, "!today please", { messageId: "message-words" })
      yield* chat(world, "today", { messageId: "message-bare" })
      assert.deepStrictEqual(yield* chatSends(world), [])
      assert.deepStrictEqual(yield* todayTimes(world), {
        cooldownUntil: null,
        lastAnsweredAt: null,
      })
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-case"))
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-words"))
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-bare"))
    }).pipe(Effect.scoped),
  )

  it.effect("a Disabled Chat Command is ignored and stores nothing", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* world.channelStore.writeChatCommand({
        ...chatCommandOf("today", "Building Chat Commands"),
        status: "Disabled",
      })
      yield* chat(world, "!today", { messageId: "message-disabled" })
      assert.deepStrictEqual(yield* chatSends(world), [])
      assert.deepStrictEqual(yield* todayTimes(world), {
        cooldownUntil: null,
        lastAnsweredAt: null,
      })
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-disabled"))
    }).pipe(Effect.scoped),
  )

  it.effect("an Invocation in Cooldown is ignored until the Cooldown ends", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* chat(world, "!today", { messageId: "message-first" })
      yield* TestClock.adjust("9 seconds")
      yield* chat(world, "!today", { messageId: "message-cooling" })
      assert.deepStrictEqual(yield* chatSends(world), [todayReply])
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-cooling"))
      yield* TestClock.adjust("1 second")
      yield* chat(world, "!today", { messageId: "message-again" })
      assert.deepStrictEqual(yield* chatSends(world), [todayReply, todayReply])
      assert.deepStrictEqual(yield* todayTimes(world), {
        cooldownUntil: "2026-09-11T12:00:20.000Z",
        lastAnsweredAt: "2026-09-11T12:00:10.000Z",
      })
    }).pipe(Effect.scoped),
  )

  it.effect("a line from another channel in shared chat is ignored and stores nothing", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* chat(world, "!today", {
        sourceBroadcasterId: "other-channel",
        messageId: "message-shared",
      })
      assert.deepStrictEqual(yield* chatSends(world), [])
      assert.isFalse(yield* world.channelStore.hasSeenNotification("message-shared"))
      // A line typed in the Broadcaster's own channel during shared chat is theirs to answer.
      yield* chat(world, "!today", { sourceBroadcasterId: "twitch-user-1" })
      assert.deepStrictEqual(yield* chatSends(world), [todayReply])
    }).pipe(Effect.scoped),
  )

  it.effect("a resend of an answered Invocation is acknowledged and not answered again", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* chat(world, "!today", { messageId: "message-resent" })
      yield* TestClock.adjust("1 minute")
      yield* chat(world, "!today", { messageId: "message-resent" })
      assert.deepStrictEqual(yield* chatSends(world), [todayReply])
    }).pipe(Effect.scoped),
  )

  it.effect("a reply Twitch drops leaves no Cooldown, so the next Invocation is answered", () =>
    Effect.gen(function* () {
      const world = yield* worldWithChatCommand()
      yield* world.providers.twitchHelix.set({
        ...helixScenario,
        chatSend: { _tag: "Dropped", code: "msg_rejected", message: "Your message was rejected." },
      })
      yield* chat(world, "!today")
      assert.deepStrictEqual(yield* chatSends(world), [todayReply])
      assert.strictEqual((yield* todayTimes(world)).cooldownUntil, null)
      yield* world.providers.twitchHelix.set(helixScenario)
      yield* chat(world, "!today")
      assert.deepStrictEqual(yield* chatSends(world), [todayReply, todayReply])
      assert.strictEqual((yield* todayTimes(world)).cooldownUntil, "2026-09-11T12:00:10.000Z")
    }).pipe(Effect.scoped),
  )

  it.effect(
    "a Twitch Connection that is Reauthorization Required leaves no Cooldown, so the next Invocation is answered",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithChatCommand()
        yield* world.stores.twitch.writeConnection({
          ...twitchConnection,
          status: "Reauthorization Required",
        })
        yield* chat(world, "!today")
        assert.deepStrictEqual(yield* chatSends(world), [])
        assert.strictEqual((yield* todayTimes(world)).cooldownUntil, null)
        yield* world.stores.twitch.writeConnection(twitchConnection)
        yield* chat(world, "!today")
        assert.deepStrictEqual(yield* chatSends(world), [todayReply])
      }).pipe(Effect.scoped),
  )
})

describe("a Song Request that fails", () => {
  it.effect("while Offline is cancelled and the viewer told, without a Spotify call", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.channelStore.writeState("Offline")
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(spotifyRequests(requests), [])
      assertCancelled(
        requests,
        "song requests are off while the stream is offline, points refunded.",
      )
    }).pipe(Effect.scoped),
  )

  it.effect("with an input that is not a track link is cancelled without a Spotify call", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      const requests = yield* songRequest(world, "https://open.spotify.com/album/abc")
      assert.deepStrictEqual(spotifyRequests(requests), [])
      assertCancelled(requests, "that isn't a Spotify track link, points refunded.")
    }).pipe(Effect.scoped),
  )

  it.effect("while the Spotify Connection is Not Configured is cancelled as unavailable", () =>
    Effect.gen(function* () {
      const world = yield* worldWithReward(false)
      yield* world.channelStore.writeState("Live")
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(
        requests.filter((request) => request.hostname !== "api.twitch.tv"),
        [],
      )
      assertCancelled(requests, "couldn't add that track, points refunded.")
    }).pipe(Effect.scoped),
  )

  it.effect(
    "while the Spotify Connection is Reauthorization Required is cancelled as unavailable",
    () =>
      Effect.gen(function* () {
        const world = yield* worldLiveWithSpotify()
        yield* world.stores.spotify.writeConnection({
          ...authorizedConnection,
          status: "Reauthorization Required",
        })
        const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
        assert.deepStrictEqual(
          requests.filter((request) => request.hostname !== "api.twitch.tv"),
          [],
        )
        assertCancelled(requests, "couldn't add that track, points refunded.")
      }).pipe(Effect.scoped),
  )

  it.effect("whose track lookup fails after the queue add is fulfilled, naming the link", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify(spotifyWithTracks({}))
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(requests.map(line), [
        `POST https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3A${neverGonnaId}`,
        `GET https://api.spotify.com/v1/tracks/${neverGonnaId}`,
        `PATCH ${redemptionsUrl}`,
        `POST ${chatUrl}`,
      ])
      assert.deepStrictEqual(requests[2]?.json, { status: "FULFILLED" })
      assert.deepStrictEqual(
        requests[3]?.json,
        chatMessage(`@Viewer added https://open.spotify.com/track/${neverGonnaId} to the queue.`),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("while Spotify reports no active device is cancelled as nothing playing", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify({
        ...spotifyWithTracks(),
        queueRefusal: {
          status: 404,
          message: "Player command failed: No active device found",
          reason: "NO_ACTIVE_DEVICE",
        },
      })
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(spotifyRequests(requests).map(line), [
        `POST https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3A${neverGonnaId}`,
      ])
      assertCancelled(requests, "Spotify isn't playing right now, points refunded.")
    }).pipe(Effect.scoped),
  )

  it.effect("that Spotify refuses for any other reason is cancelled as failed", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify({
        ...spotifyWithTracks(),
        queueRefusal: { status: 503, message: "Service unavailable" },
      })
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(spotifyRequests(requests).map(line), [
        `POST https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3A${neverGonnaId}`,
      ])
      assertCancelled(requests, "couldn't add that track, points refunded.")
    }).pipe(Effect.scoped),
  )

  it.effect("whose refund reply Twitch refuses is still cancelled", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.channelStore.writeState("Offline")
      yield* world.providers.twitchHelix.set({
        ...helixScenario,
        chatSend: { _tag: "Refused", status: 500 },
      })
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(requests.map(line), [`PATCH ${redemptionsUrl}`, `POST ${chatUrl}`])
      assert.deepStrictEqual(requests[0]?.json, { status: "CANCELED" })
    }).pipe(Effect.scoped),
  )

  it.effect("whose reply Twitch does not show is still fulfilled", () =>
    Effect.gen(function* () {
      const world = yield* worldLiveWithSpotify()
      yield* world.providers.twitchHelix.set({
        ...helixScenario,
        chatSend: { _tag: "Dropped", code: "msg_rejected", message: "Your message was rejected." },
      })
      const requests = yield* songRequest(world, `spotify:track:${neverGonnaId}`)
      assert.deepStrictEqual(requests.slice(2).map(line), [
        `PATCH ${redemptionsUrl}`,
        `POST ${chatUrl}`,
      ])
      assert.deepStrictEqual(requests[2]?.json, { status: "FULFILLED" })
    }).pipe(Effect.scoped),
  )
})
