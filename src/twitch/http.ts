import { HttpApiBuilder, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Config, Effect, Layer, Redacted } from "effect"
import * as Crypto from "node:crypto"
import { ApiV1 } from "../api.js"
import { TwitchEventsubRequestHeaders } from "../domain/twitch.js"
import { SignatureVerificationError, VerifyWebhookSignature } from "./api.js"
import { TwitchClient } from "./client.js"

export const VerifyWebhookSignatureLayer = Layer.effect(
  VerifyWebhookSignature,
  Effect.gen(function*() {
    const secret = yield* Config.redacted("TWITCH_EVENTSUB_WEBHOOK_SECRET")

    function getHmac(message: string) {
      return Crypto.createHmac("sha256", Redacted.value(secret))
        .update(message)
        .digest("hex")
    }

    function verifyMessage(hmac: string, signature: string) {
      return Crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature))
    }

    // @effect-diagnostics effect/returnEffectInGen:off
    return Effect.gen(function*() {
      const headers = yield* HttpServerRequest.schemaHeaders(TwitchEventsubRequestHeaders)
      const body = yield* Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => request.text)
      const signature = headers["twitch-eventsub-message-signature"]
      const messageId = headers["twitch-eventsub-message-id"]
      const timestamp = headers["twitch-eventsub-message-timestamp"]

      const message = messageId + timestamp + body
      const hmac = "sha256=" + getHmac(message)
      const isVerified = verifyMessage(hmac, signature)
      yield* Effect.logDebug("Verifying HMAC signature for webhook request").pipe(
        Effect.annotateLogs({ signature, hmac, isVerified })
      )

      return isVerified ? Effect.void : new SignatureVerificationError()
    }).pipe(Effect.catchTag("ParseError", "RequestError", () => new SignatureVerificationError()))
  }).pipe(Effect.annotateLogs({
    service: "VerifyWebhookSignature"
  }))
)

export const TwitchHttpLayer = HttpApiBuilder.group(
  ApiV1,
  "twitch",
  Effect.fnUntraced(function*(handlers) {
    const twitchClient = yield* TwitchClient

    return handlers.handle(
      "events",
      Effect.fnUntraced(function*({ headers, payload }) {
        const messageType = headers["twitch-eventsub-message-type"]

        if (messageType === "webhook_callback_verification" && payload._tag === "WebhookChallenge") {
          return HttpServerResponse.text(payload.challenge)
        }

        if (messageType === "notification" && payload._tag === "Notification") {
          yield* twitchClient.notify(payload)
        }

        if (messageType === "revocation" && payload._tag === "Revocation") {
          yield* Effect.log(`${payload.subscription.type} notifications were revoked`).pipe(
            Effect.annotateLogs({
              reason: payload.subscription.status,
              condition: payload.subscription.condition
            })
          )
        }

        return HttpServerResponse.empty()
      })
    )
  })
).pipe(Layer.provide([
  TwitchClient.Default,
  VerifyWebhookSignatureLayer
]))
