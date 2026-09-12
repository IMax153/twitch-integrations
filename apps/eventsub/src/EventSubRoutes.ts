import { eventSubPath } from "@twitch-integrations/infra/Domain"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { makeVerifier, type SignedMessage } from "./Signature.ts"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"

/** The one path Twitch delivers to; every other path and method gets an empty 404. */
const webhookPath = eventSubPath

/**
 * The largest body the receiver reads. Twitch's example redemption
 * notification is 1.3 KB minified, and the fields that grow (viewer input,
 * a 45-character title, a 200-character prompt, display names) cannot
 * approach this.
 */
const maxBodyBytes = 16 * 1024

const notFound = HttpServerResponse.empty({ status: 404 })

const tooLarge = HttpServerResponse.empty({ status: 413 })

const forbidden = HttpServerResponse.empty({ status: 403 })

const badRequest = HttpServerResponse.empty({ status: 400 })

const accepted = HttpServerResponse.empty({ status: 204 })

/** Twitch's replay guard: a message stamped earlier than this before the receiver's clock is refused. */
const maxMessageAge = Duration.minutes(10)

/** Whether the timestamp header is parseable and no older than the guard allows. A future stamp is accepted. */
const isFresh = (timestamp: string): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const sentAt = DateTime.make(timestamp)
    if (Option.isNone(sentAt)) {
      return false
    }
    const now = yield* DateTime.now
    const age = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(sentAt.value)
    return age <= Duration.toMillis(maxMessageAge)
  })

/** The one field of a verification message the receiver needs: the value Twitch wants echoed back. */
const Challenge = Schema.Struct({ challenge: Schema.String }).annotate({ identifier: "Challenge" })

const decodeChallenge = Schema.decodeUnknownOption(Schema.fromJsonString(Challenge))

/**
 * Twitch's verification message, answered with the raw challenge and
 * nothing else: no JSON encoding, no whitespace, as `text/plain`.
 */
const answerChallenge = (body: string) =>
  Option.match(decodeChallenge(body), {
    onNone: () => badRequest,
    onSome: ({ challenge }) => HttpServerResponse.text(challenge),
  })

/** The signed message's headers, or none when any is missing; Twitch sends all three on every message. */
const readSignedHeaders = (headers: Headers.Headers): Option.Option<Omit<SignedMessage, "body">> =>
  Option.all({
    messageId: Headers.get(headers, "twitch-eventsub-message-id"),
    timestamp: Headers.get(headers, "twitch-eventsub-message-timestamp"),
    signature: Headers.get(headers, "twitch-eventsub-message-signature"),
  })

const decimal = /^\d+$/

/** The declared body size, or none when the request declares none or declares nonsense. */
const declaredLength = (headers: Headers.Headers): Option.Option<number> =>
  Headers.get(headers, "content-length").pipe(
    Option.filter((raw) => decimal.test(raw)),
    Option.map(Number),
  )

/** The Worker's HTTP handler, built once over the configured secret. */
export const EventSubHttp = Effect.flatMap(WebhookSecret, makeVerifier).pipe(
  Effect.map((verify) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (
        request.method !== "POST" ||
        new URL(request.url, "https://receiver").pathname !== webhookPath
      ) {
        return notFound
      }
      const length = declaredLength(request.headers)
      if (Option.isSome(length) && length.value > maxBodyBytes) {
        return tooLarge
      }
      const signed = readSignedHeaders(request.headers)
      if (Option.isNone(signed)) {
        return forbidden
      }
      const body = yield* Effect.option(request.text)
      if (Option.isNone(body)) {
        return badRequest
      }
      // A request that declares no length is only refused once read. A UTF-16
      // length over the limit is certainly over it in bytes; the backstop is
      // coarse on purpose, the declared-length check above is the real guard.
      if (body.value.length > maxBodyBytes) {
        return tooLarge
      }
      if (!(yield* verify({ ...signed.value, body: body.value }))) {
        return forbidden
      }
      if (!(yield* isFresh(signed.value.timestamp))) {
        return forbidden
      }
      const messageType = Headers.get(request.headers, "twitch-eventsub-message-type")
      if (Option.isSome(messageType) && messageType.value === "webhook_callback_verification") {
        return answerChallenge(body.value)
      }
      return accepted
    }),
  ),
)
