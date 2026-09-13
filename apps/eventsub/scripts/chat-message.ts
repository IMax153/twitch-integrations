/**
 * Sends one `channel.chat.message` notification to the local receiver, signed
 * the way Twitch signs it, since the Twitch CLI (1.1.25) cannot trigger this
 * event type. Run from the repo root with the secret in the environment:
 *
 *     node --env-file=.env apps/eventsub/scripts/chat-message.ts '!today'
 *
 * The chatter is a made-up viewer; `--broadcaster` sends the line as the
 * broadcaster, and `--from <id>` marks it as shared chat from another
 * channel. The broadcaster is `twitch-user-1` unless `TWITCH_BROADCASTER_ID`
 * is set, and the receiver is on its `alchemy dev` port unless
 * `EVENTSUB_RECEIVER` names another URL.
 */
import * as Config from "effect/Config"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { createHmac, randomUUID } from "node:crypto"

const args = process.argv.slice(2)
const text = args.find((argument) => !argument.startsWith("--")) ?? "!today"
const asBroadcaster = args.includes("--broadcaster")
const fromIndex = args.indexOf("--from")
const sourceBroadcasterId = fromIndex === -1 ? null : (args[fromIndex + 1] ?? null)

const settings = Config.all({
  secret: Config.Redacted("TWITCH_EVENTSUB_SECRET"),
  broadcasterId: Config.String("TWITCH_BROADCASTER_ID").pipe(Config.withDefault("twitch-user-1")),
  receiver: Config.String("EVENTSUB_RECEIVER").pipe(
    Config.withDefault("http://127.0.0.1:1338/eventsub/twitch"),
  ),
})

const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

/** The notification body as Twitch sends it, with the text the chatter typed. */
const notificationBody = (broadcasterId: string, receiver: string, createdAt: string) => {
  const chatter = asBroadcaster
    ? { id: broadcasterId, login: "broadcaster", name: "Broadcaster" }
    : { id: "viewer-1", login: "viewer", name: "Viewer" }
  return toJson({
    subscription: {
      id: randomUUID(),
      type: "channel.chat.message",
      version: "1",
      status: "enabled",
      cost: 0,
      condition: { broadcaster_user_id: broadcasterId, user_id: broadcasterId },
      transport: { method: "webhook", callback: receiver },
      created_at: createdAt,
    },
    event: {
      broadcaster_user_id: broadcasterId,
      broadcaster_user_login: "broadcaster",
      broadcaster_user_name: "Broadcaster",
      source_broadcaster_user_id: sourceBroadcasterId,
      source_broadcaster_user_login: null,
      source_broadcaster_user_name: null,
      chatter_user_id: chatter.id,
      chatter_user_login: chatter.login,
      chatter_user_name: chatter.name,
      message_id: randomUUID(),
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

/** Twitch's signature: the hex HMAC-SHA256 over message ID, timestamp, and raw body, with its algorithm prefix. */
const sign = (secret: Redacted.Redacted<string>, id: string, timestamp: string, body: string) =>
  `sha256=${createHmac("sha256", Redacted.value(secret))
    .update(`${id}${timestamp}${body}`)
    .digest("hex")}`

const send = Effect.gen(function* () {
  const { secret, broadcasterId, receiver } = yield* settings
  const client = yield* HttpClient.HttpClient
  const timestamp = DateTime.formatIso(yield* DateTime.now)
  const messageId = randomUUID()
  const body = notificationBody(broadcasterId, receiver, timestamp)
  const request = HttpClientRequest.post(receiver).pipe(
    HttpClientRequest.setHeaders({
      "twitch-eventsub-message-id": messageId,
      "twitch-eventsub-message-timestamp": timestamp,
      "twitch-eventsub-message-type": "notification",
      "twitch-eventsub-message-signature": sign(secret, messageId, timestamp, body),
      "twitch-eventsub-subscription-type": "channel.chat.message",
      "twitch-eventsub-subscription-version": "1",
    }),
    HttpClientRequest.bodyText(body, "application/json"),
  )
  const response = yield* client.execute(request)
  yield* Effect.log(`${response.status} for ${toJson(text)} as message ${messageId}`)
  if (response.status !== 204) {
    return yield* Effect.die(new Error(`The receiver answered ${response.status}, not 204`))
  }
})

// The script's entry point.
// oxlint-disable-next-line effecttsgo/strict-effect-provide
await Effect.runPromise(send.pipe(Effect.provide(FetchHttpClient.layer), Effect.scoped))
