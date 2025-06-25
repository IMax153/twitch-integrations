import { HttpBody, HttpClient, HttpClientRequest, HttpClientResponse, UrlParams } from "@effect/platform"
import { Config, Data, Effect, Option, PubSub, Redacted, Schema, Stream } from "effect"
import type {
  TwitchEventsubEvent,
  TwitchEventsubNotification,
  TwitchEventsubSubscriptionType
} from "../domain/twitch.js"
import { TwitchEventsubSubscriptionResponse } from "../domain/twitch.js"
import { TwitchAuth } from "./auth.js"

export class TwitchError extends Data.TaggedError("TwitchError")<{
  readonly cause: unknown
}> {}

export class TwitchClient extends Effect.Service<TwitchClient>()("app/Twitch/Client", {
  effect: Effect.gen(function*() {
    const hostname = yield* Config.string("APPLICATION_HOSTNAME")
    const baseUrl = yield* Config.url("TWITCH_API_BASE_URL")
    const twitchClientId = yield* Config.string("TWITCH_CLIENT_ID")
    const twitchBroadcasterId = yield* Config.string("TWITCH_BROADCASTER_ID")
    const twitchUserId = yield* Config.string("TWITCH_USER_ID")
    const secret = yield* Config.redacted("TWITCH_EVENTSUB_WEBHOOK_SECRET")

    const auth = yield* TwitchAuth
    const notifications = yield* PubSub.bounded<TwitchEventsubNotification>(100)

    const notify = Effect.fn("TwitchClient.notify")(
      (notification: TwitchEventsubNotification) => PubSub.publish(notifications, notification)
    )

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(baseUrl.toString()),
          HttpClientRequest.setHeader("Client-Id", twitchClientId),
          HttpClientRequest.acceptJson
        )
      ),
      HttpClient.filterStatusOk
    )

    const appTokenClient = HttpClient.mapRequestEffect(
      httpClient,
      Effect.fnUntraced(function*(request) {
        const { accessToken } = yield* auth.getToken("app")
        return HttpClientRequest.bearerToken(request, accessToken)
      })
    )

    const userTokenClient = HttpClient.mapRequestEffect(
      httpClient,
      Effect.fnUntraced(function*(request) {
        const { accessToken } = yield* auth.getToken("user")
        return HttpClientRequest.bearerToken(request, accessToken)
      })
    )

    const sendChatMessage = Effect.fn("TwitchClient.sendChatMessage")(
      (message: string) =>
        userTokenClient.post("/helix/chat/messages", {
          body: HttpBody.unsafeJson({
            broadcaster_id: twitchBroadcasterId,
            sender_id: twitchUserId,
            message
          })
        }),
      Effect.mapError((cause) => new TwitchError({ cause }))
    )

    const redeemChannelReward = Effect.fn("TwitchClient.redeemChannelReward")(
      function*(rewardId: string, redemptionId: string) {
        yield* userTokenClient.patch("/helix/channel_points/custom_rewards/redemptions", {
          body: HttpBody.unsafeJson({
            status: "FULFILLED"
          }),
          urlParams: UrlParams.fromInput({
            broadcaster_id: twitchBroadcasterId,
            reward_id: rewardId,
            id: redemptionId
          })
        })
      },
      Effect.mapError((cause) => new TwitchError({ cause }))
    )

    const refundChannelReward = Effect.fn("TwitchClient.refundChannelReward")(
      function*(rewardId: string, redemptionId: string) {
        yield* userTokenClient.patch("/helix/channel_points/custom_rewards/redemptions", {
          body: HttpBody.unsafeJson({
            status: "CANCELED"
          }),
          urlParams: UrlParams.fromInput({
            broadcaster_id: twitchBroadcasterId,
            reward_id: rewardId,
            id: redemptionId
          })
        })
      },
      Effect.mapError((cause) => new TwitchError({ cause }))
    )

    const subscribeToEvent = Effect.fn("TwitchClient.subscribeToEvent")(
      function*<Type extends TwitchEventsubSubscriptionType>(type: Type, options: {
        readonly version?: string
        readonly condition: Record<string, string>
      }) {
        yield* Effect.logDebug("Subscribing to Twitch Eventsub event: ", type)
        return yield* appTokenClient.post("/helix/eventsub/subscriptions", {
          body: HttpBody.unsafeJson({
            type,
            version: options.version ?? "1",
            condition: options.condition,
            transport: {
              method: "webhook",
              callback: `${hostname}/v1/twitch/events`,
              secret: Redacted.value(secret)
            }
          })
        }).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(TwitchEventsubSubscriptionResponse))
        )
      }
    )

    const unsubscribeFromEvent = Effect.fn("TwitchClient.unsubscribeFromEvent")(
      function*(id: string) {
        return yield* appTokenClient.del("/helix/eventsub/subscriptions", {
          urlParams: UrlParams.fromInput({ id })
        })
      },
      (self, id) => Effect.catchAll(self, (error) => Effect.logError(`Failed to delete subscription: ${id}`, error))
    )

    const listenForEvent = <Type extends TwitchEventsubSubscriptionType>(type: Type, options: {
      readonly version?: string
      readonly condition: Record<string, string>
    }): Stream.Stream<Extract<TwitchEventsubEvent, { type: Type }>, TwitchError> =>
      Effect.acquireRelease(
        subscribeToEvent(type, options),
        (subscription) => unsubscribeFromEvent(subscription.data[0].id)
      ).pipe(
        Effect.catchAllCause((cause) => new TwitchError({ cause })),
        Effect.as(Stream.fromPubSub(notifications)),
        Stream.unwrapScoped,
        Stream.tap((event) => Effect.logTrace(event)),
        Stream.filterMap(({ event, subscription }) =>
          subscription.type === type
            ? Option.some(event as Extract<TwitchEventsubEvent, { type: Type }>)
            : Option.none()
        )
      )

    // Clear any previous subscriptions before allowing new ones
    yield* appTokenClient.get("/helix/eventsub/subscriptions").pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Schema.Struct({
        data: Schema.Array(Schema.Struct({ id: Schema.String, type: Schema.String }))
      }))),
      Effect.map(({ data }) => data),
      Effect.flatMap(Effect.forEach(({ id, type }) =>
        Effect.zipRight(
          Effect.logDebug(`Deleting previous Eventsub subscription to "${type}" events (${id})`),
          unsubscribeFromEvent(id)
        ), { concurrency: "unbounded" })),
      Effect.ignoreLogged
    )

    return {
      sendChatMessage,
      redeemChannelReward,
      refundChannelReward,
      notify,
      listenForEvent
    } as const
  }),
  dependencies: [TwitchAuth.Default]
}) {}
