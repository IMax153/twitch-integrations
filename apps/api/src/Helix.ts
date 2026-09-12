import type { EventSubscriptionType } from "@twitch-integrations/domain/EventSubscription"
import type { Reward, RewardSettings } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { type ProviderFailureReason, failureReason, refusalDetail } from "./Provider.ts"
import { ProviderCredentials } from "./ProviderCredentials.ts"

export type HelixOperation =
  | "list rewards"
  | "create reward"
  | "update reward"
  | "list subscriptions"
  | "create subscription"
  | "delete subscription"
  | "get stream"
  | "update redemption"
  | "send chat message"

/**
 * A Helix call failed. Carries only what the failure was, never the request
 * or response: those hold the access token, and this error may be logged.
 * Twitch's own account of a refused request, such as
 * `CREATE_CUSTOM_REWARD_DUPLICATE_REWARD`, is kept when it gave one.
 */
export class HelixRequestFailed extends Data.TaggedError("HelixRequestFailed")<{
  readonly operation: HelixOperation
  readonly reason: ProviderFailureReason
  /** Twitch's own account of a refusal, when it gave one. */
  readonly detail?: string
}> {}

/** The one field of a Helix error body worth keeping: Twitch's account of the refusal, which names no secret. */
const HelixError = Schema.Struct({ message: Schema.String }).annotate({ identifier: "HelixError" })

const readHelixError = HttpClientResponse.schemaBodyJson(HelixError)

/** Twitch's message for a refused request, when it gave one. */
const helixMessage = refusalDetail((response) =>
  Effect.map(readHelixError(response), (body) => body.message),
)

/** An Event Subscription as Helix reports it. */
export interface HelixEventSubscription {
  readonly id: string
  readonly type: string
  readonly version: string
  readonly status: string
}

/** What an update may change on a reward: its settings, its pause state, or both. */
export interface RewardUpdate {
  readonly settings?: RewardSettings
  readonly isPaused?: boolean
}

export interface EventSubscriptionRequest {
  readonly type: EventSubscriptionType
  readonly version: string
  readonly condition: Readonly<Record<string, string>>
}

/** Where Twitch delivers notifications and the secret it signs them with. */
export interface WebhookTransport {
  readonly callback: string
  readonly secret: Redacted.Redacted<string>
}

/** An access token as the Channel holds it: redacted, so it never prints. */
export type AccessToken = Redacted.Redacted<string>

/** The two ways a Redemption ends on Twitch; cancelling refunds the viewer's points. */
export type RedemptionStatus = "FULFILLED" | "CANCELED"

/** What Twitch made of a chat message: whether it was shown, and why not when it was not. */
export interface ChatSendResult {
  readonly isSent: boolean
  readonly dropReason: Option.Option<string>
}

export interface HelixService {
  /** The custom rewards on the channel that this client ID may manage. */
  readonly listManageableRewards: (
    token: AccessToken,
    broadcasterId: string,
  ) => Effect.Effect<ReadonlyArray<Reward>, HelixRequestFailed>
  /** Creates a custom reward with the settings and every fixed setting the spec requires. */
  readonly createReward: (
    token: AccessToken,
    broadcasterId: string,
    settings: RewardSettings,
  ) => Effect.Effect<Reward, HelixRequestFailed>
  readonly updateReward: (
    token: AccessToken,
    broadcasterId: string,
    rewardId: string,
    update: RewardUpdate,
  ) => Effect.Effect<Reward, HelixRequestFailed>
  /** Every Event Subscription this client ID owns, across every page. */
  readonly listEventSubscriptions: (
    appToken: AccessToken,
  ) => Effect.Effect<ReadonlyArray<HelixEventSubscription>, HelixRequestFailed>
  readonly createEventSubscription: (
    appToken: AccessToken,
    request: EventSubscriptionRequest,
    transport: WebhookTransport,
  ) => Effect.Effect<HelixEventSubscription, HelixRequestFailed>
  readonly deleteEventSubscription: (
    appToken: AccessToken,
    id: string,
  ) => Effect.Effect<void, HelixRequestFailed>
  /** Whether Get Streams reports the user broadcasting live right now. */
  readonly isLive: (
    token: AccessToken,
    userId: string,
  ) => Effect.Effect<boolean, HelixRequestFailed>
  /** Ends a Redemption of the Reward; Twitch allows this only while it is unfulfilled. */
  readonly updateRedemptionStatus: (
    token: AccessToken,
    broadcasterId: string,
    rewardId: string,
    redemptionId: string,
    status: RedemptionStatus,
  ) => Effect.Effect<void, HelixRequestFailed>
  /** Sends a chat message to the broadcaster's chat as the broadcaster, who is the Twitch Connected Account. */
  readonly sendChatMessage: (
    token: AccessToken,
    broadcasterId: string,
    message: string,
  ) => Effect.Effect<ChatSendResult, HelixRequestFailed>
}

const helix = "https://api.twitch.tv/helix"

const rewardsEndpoint = `${helix}/channel_points/custom_rewards`
const subscriptionsEndpoint = `${helix}/eventsub/subscriptions`
const streamsEndpoint = `${helix}/streams`
const redemptionsEndpoint = `${rewardsEndpoint}/redemptions`
const chatEndpoint = `${helix}/chat/messages`

const RewardWire = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  cost: Schema.Int,
  prompt: Schema.String,
  is_paused: Schema.Boolean,
}).annotate({ identifier: "RewardWire" })

const RewardsResponse = Schema.Struct({ data: Schema.Array(RewardWire) }).annotate({
  identifier: "RewardsResponse",
})

const EventSubscriptionWire = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  version: Schema.String,
  status: Schema.String,
}).annotate({ identifier: "EventSubscriptionWire" })

const EventSubscriptionsResponse = Schema.Struct({
  data: Schema.Array(EventSubscriptionWire),
  pagination: Schema.optional(
    Schema.Struct({ cursor: Schema.optional(Schema.String) }).annotate({
      identifier: "Pagination",
    }),
  ),
}).annotate({ identifier: "EventSubscriptionsResponse" })

const StreamWire = Schema.Struct({ type: Schema.String }).annotate({ identifier: "StreamWire" })

const StreamsResponse = Schema.Struct({ data: Schema.Array(StreamWire) }).annotate({
  identifier: "StreamsResponse",
})

/** Why Twitch did not show a chat message, given when `is_sent` is false. */
const DropReason = Schema.Struct({ code: Schema.String, message: Schema.String }).annotate({
  identifier: "DropReason",
})

const ChatMessageWire = Schema.Struct({
  is_sent: Schema.Boolean,
  drop_reason: DropReason.pipe(Schema.NullOr, Schema.optional),
}).annotate({ identifier: "ChatMessageWire" })

const ChatMessagesResponse = Schema.Struct({ data: Schema.Array(ChatMessageWire) }).annotate({
  identifier: "ChatMessagesResponse",
})

const readRewards = HttpClientResponse.schemaBodyJson(RewardsResponse)
const readChatMessages = HttpClientResponse.schemaBodyJson(ChatMessagesResponse)
const readEventSubscriptions = HttpClientResponse.schemaBodyJson(EventSubscriptionsResponse)
const readStreams = HttpClientResponse.schemaBodyJson(StreamsResponse)

const rewardOf = (wire: typeof RewardWire.Type): Reward => ({
  id: wire.id,
  title: wire.title,
  cost: wire.cost,
  prompt: wire.prompt,
  isPaused: wire.is_paused,
})

/**
 * The reward settings on the wire: the three the spec varies plus the
 * fixed ones, sent on every create and settings update so a value changed
 * in the Twitch dashboard is put back. Whether the reward is enabled is not
 * among them: the spec fixes no value for it, so a Broadcaster who disables
 * the Reward in the dashboard is left alone.
 */
const settingsBody = (settings: RewardSettings) => ({
  title: settings.title,
  cost: settings.cost,
  prompt: settings.prompt,
  is_user_input_required: true,
  is_max_per_stream_enabled: false,
  is_max_per_user_per_stream_enabled: false,
  is_global_cooldown_enabled: false,
  should_redemptions_skip_request_queue: false,
})

const updateBody = (update: RewardUpdate): Record<string, unknown> => ({
  ...(update.settings === undefined ? {} : settingsBody(update.settings)),
  ...(update.isPaused === undefined ? {} : { is_paused: update.isPaused }),
})

/**
 * The one item a create or update answers with. Helix wraps it in a `data`
 * array; an empty one is a body the deployment cannot use.
 */
const single =
  (operation: HelixOperation) =>
  <A>(response: { readonly data: ReadonlyArray<A> }): Effect.Effect<A, HelixRequestFailed> =>
    Option.match(Option.fromUndefinedOr(response.data[0]), {
      onNone: () => new HelixRequestFailed({ operation, reason: { _tag: "Body" } }),
      onSome: Effect.succeed,
    })

const make = Effect.gen(function* () {
  const clientId = (yield* ProviderCredentials).twitch.clientId
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)

  /** Names the operation a transport, refusal, or body failure belongs to; a failure already named passes through. */
  const failed =
    (operation: HelixOperation) =>
    (
      cause: HttpClientError.HttpClientError | Schema.SchemaError | HelixRequestFailed,
    ): Effect.Effect<never, HelixRequestFailed> =>
      cause._tag === "HelixRequestFailed"
        ? Effect.fail(cause)
        : Effect.flatMap(helixMessage(cause), (detail) =>
            Effect.fail(
              new HelixRequestFailed({
                operation,
                reason: failureReason(cause),
                ...Option.match(detail, {
                  onNone: () => ({}),
                  onSome: (detail) => ({ detail }),
                }),
              }),
            ),
          )

  /** Every Helix request carries the client ID and the token as a bearer. */
  const authorized = (token: AccessToken) => (request: HttpClientRequest.HttpClientRequest) =>
    request.pipe(
      HttpClientRequest.bearerToken(token),
      HttpClientRequest.setHeader("client-id", Redacted.value(clientId)),
    )

  const service: HelixService = {
    listManageableRewards: Effect.fn("Helix.listManageableRewards")(
      function* (token: AccessToken, broadcasterId: string) {
        const request = HttpClientRequest.get(rewardsEndpoint).pipe(
          HttpClientRequest.setUrlParams({
            broadcaster_id: broadcasterId,
            only_manageable_rewards: "true",
          }),
          authorized(token),
        )
        const response = yield* readRewards(yield* client.execute(request))
        return response.data.map(rewardOf)
      },
      Effect.catch(failed("list rewards")),
    ),

    createReward: Effect.fn("Helix.createReward")(
      function* (token: AccessToken, broadcasterId: string, settings: RewardSettings) {
        const request = HttpClientRequest.post(rewardsEndpoint).pipe(
          HttpClientRequest.setUrlParams({ broadcaster_id: broadcasterId }),
          HttpClientRequest.bodyJsonUnsafe(settingsBody(settings)),
          authorized(token),
        )
        const response = yield* readRewards(yield* client.execute(request))
        return rewardOf(yield* single("create reward")(response))
      },
      Effect.catch(failed("create reward")),
    ),

    updateReward: Effect.fn("Helix.updateReward")(
      function* (
        token: AccessToken,
        broadcasterId: string,
        rewardId: string,
        update: RewardUpdate,
      ) {
        const request = HttpClientRequest.patch(rewardsEndpoint).pipe(
          HttpClientRequest.setUrlParams({ broadcaster_id: broadcasterId, id: rewardId }),
          HttpClientRequest.bodyJsonUnsafe(updateBody(update)),
          authorized(token),
        )
        const response = yield* readRewards(yield* client.execute(request))
        return rewardOf(yield* single("update reward")(response))
      },
      Effect.catch(failed("update reward")),
    ),

    listEventSubscriptions: (appToken) => {
      /** One page of subscriptions, from the cursor when there is one. */
      const pageAfter = (cursor: string | undefined) =>
        HttpClientRequest.get(subscriptionsEndpoint).pipe(
          HttpClientRequest.setUrlParams(cursor === undefined ? {} : { after: cursor }),
          authorized(appToken),
          client.execute,
          Effect.flatMap(readEventSubscriptions),
        )
      const collect = (
        cursor: string | undefined,
        collected: ReadonlyArray<HelixEventSubscription>,
      ): Effect.Effect<
        ReadonlyArray<HelixEventSubscription>,
        HttpClientError.HttpClientError | Schema.SchemaError
      > =>
        Effect.flatMap(pageAfter(cursor), (page) => {
          const all = [...collected, ...page.data]
          const next = page.pagination?.cursor
          return next === undefined ? Effect.succeed(all) : collect(next, all)
        })
      return collect(undefined, []).pipe(Effect.catch(failed("list subscriptions")))
    },

    createEventSubscription: Effect.fn("Helix.createEventSubscription")(
      function* (
        appToken: AccessToken,
        subscription: EventSubscriptionRequest,
        transport: WebhookTransport,
      ) {
        const request = HttpClientRequest.post(subscriptionsEndpoint).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            type: subscription.type,
            version: subscription.version,
            condition: subscription.condition,
            transport: {
              method: "webhook",
              callback: transport.callback,
              secret: Redacted.value(transport.secret),
            },
          }),
          authorized(appToken),
        )
        const response = yield* readEventSubscriptions(yield* client.execute(request))
        return yield* single("create subscription")(response)
      },
      Effect.catch(failed("create subscription")),
    ),

    deleteEventSubscription: (appToken, id) =>
      HttpClientRequest.delete(subscriptionsEndpoint).pipe(
        HttpClientRequest.setUrlParams({ id }),
        authorized(appToken),
        client.execute,
        Effect.asVoid,
        Effect.catch(failed("delete subscription")),
      ),

    isLive: Effect.fn("Helix.isLive")(
      function* (token: AccessToken, userId: string) {
        const request = HttpClientRequest.get(streamsEndpoint).pipe(
          HttpClientRequest.setUrlParams({ user_id: userId }),
          authorized(token),
        )
        const response = yield* readStreams(yield* client.execute(request))
        return response.data.some((stream) => stream.type === "live")
      },
      Effect.catch(failed("get stream")),
    ),

    updateRedemptionStatus: (token, broadcasterId, rewardId, redemptionId, status) =>
      HttpClientRequest.patch(redemptionsEndpoint).pipe(
        HttpClientRequest.setUrlParams({
          broadcaster_id: broadcasterId,
          reward_id: rewardId,
          id: redemptionId,
        }),
        HttpClientRequest.bodyJsonUnsafe({ status }),
        authorized(token),
        client.execute,
        Effect.asVoid,
        Effect.catch(failed("update redemption")),
      ),

    sendChatMessage: Effect.fn("Helix.sendChatMessage")(
      function* (token: AccessToken, broadcasterId: string, message: string) {
        const request = HttpClientRequest.post(chatEndpoint).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            broadcaster_id: broadcasterId,
            sender_id: broadcasterId,
            message,
          }),
          authorized(token),
        )
        const response = yield* readChatMessages(yield* client.execute(request))
        const sent = yield* single("send chat message")(response)
        return {
          isSent: sent.is_sent,
          dropReason: Option.fromNullishOr(sent.drop_reason).pipe(
            Option.map((reason) => `${reason.code}: ${reason.message}`),
          ),
        }
      },
      Effect.catch(failed("send chat message")),
    ),
  }
  return service
})

/**
 * The Twitch Helix calls the Channel makes. Every call takes the token it
 * runs under, since rewards and streams use the Connection's token while
 * Event Subscriptions use the app access token.
 */
export class Helix extends Context.Service<Helix, HelixService>()(
  "@twitch-integrations/api/Helix",
) {
  static readonly layer: Layer.Layer<Helix, never, ProviderCredentials | HttpClient.HttpClient> =
    Layer.effect(Helix)(make)
}
