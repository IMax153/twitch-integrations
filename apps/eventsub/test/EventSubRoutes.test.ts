import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { EventSubHttp } from "../src/EventSubRoutes.ts"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"
import { createHmac } from "node:crypto"

/** The secret the receiver is configured with; the tests sign with the same value. */
const secret = "test-webhook-secret-0123"

const origin = "https://stream.example"

/** The Worker's handler over the configured secret, answering one Web request. */
const send = (request: Request): Effect.Effect<Response> =>
  Effect.gen(function* () {
    const handler = yield* EventSubHttp
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(request),
      ),
      Effect.scoped,
    )
    return HttpServerResponse.toWeb(response)
  }).pipe(Effect.provide(Layer.succeed(WebhookSecret, Redacted.make(secret))))

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
const signedRequest = (message: OutgoingMessage): Effect.Effect<Request> =>
  Effect.gen(function* () {
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

const challengeBody = (challenge: string) =>
  JSON.stringify({
    challenge,
    subscription: { id: "sub-1", status: "webhook_callback_verification_pending" },
  })

const assertEmpty = (response: Response, status: number) =>
  Effect.gen(function* () {
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

  it.effect("refuses a body declared larger than 16 KB with 413 before reading it", () =>
    Effect.gen(function* () {
      const { request, wasPulled } = unreadBody(16 * 1024 + 1)
      const response = yield* send(request)
      yield* assertEmpty(response, 413)
      assert.isFalse(wasPulled())
    }),
  )

  it.effect("refuses a body over 16 KB that declared no length once it is read", () =>
    Effect.gen(function* () {
      const request = yield* signedRequest({
        type: "notification",
        body: "x".repeat(16 * 1024 + 1),
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

  const acknowledged: ReadonlyArray<[string, string]> = [
    [
      "notification",
      JSON.stringify({
        subscription: { id: "sub-1", type: "stream.online", version: "1" },
        event: { broadcaster_user_id: "1234", type: "live" },
      }),
    ],
    [
      "revocation",
      JSON.stringify({
        subscription: { id: "sub-1", type: "stream.online", status: "authorization_revoked" },
      }),
    ],
  ]

  for (const [type, body] of acknowledged) {
    it.effect(`acknowledges a correctly signed ${type} with a 2xx and no body`, () =>
      Effect.gen(function* () {
        const response = yield* send(yield* signedRequest({ type, body }))
        assert.isTrue(response.status >= 200 && response.status < 300, `status ${response.status}`)
        assert.strictEqual(yield* Effect.promise(() => response.text()), "")
      }),
    )
  }
})
