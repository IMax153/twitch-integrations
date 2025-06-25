import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { TwitchEventsubRequest, TwitchEventsubRequestHeaders } from "../domain/twitch.js"

export class SignatureVerificationError extends Schema.TaggedError<SignatureVerificationError>(
  "app/Twitch/SignatureVerificationError"
)(
  "SignatureVerificationError",
  {},
  HttpApiSchema.annotations({ status: 403 })
) {}

export class VerifyWebhookSignature extends HttpApiMiddleware.Tag<VerifyWebhookSignature>()(
  "app/Twitch/VerifyWebhookSignature",
  { failure: SignatureVerificationError }
) {}

export class TwitchApi extends HttpApiGroup.make("twitch")
  .add(
    HttpApiEndpoint
      .post("events")`/events`
      .setHeaders(TwitchEventsubRequestHeaders)
      .setPayload(TwitchEventsubRequest)
      .addSuccess(Schema.String)
      .middleware(VerifyWebhookSignature)
  )
  .prefix("/twitch")
{}
