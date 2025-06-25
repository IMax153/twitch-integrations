import { Schema } from "effect"

export const ChannelChatMessageEvent = Schema.Struct({
  message_type: Schema.Literal(
    "channel_points_highlighted",
    "channel_points_sub_only",
    "power_ups_gigantified_emote",
    "power_ups_message_effect",
    "text",
    "user_intro"
  ).annotations({
    description: "The type of the message"
  }),
  message: Schema.Struct({ text: Schema.String }).annotations({
    description: "The full text of the message"
  })
})
export type ChannelChatMessageEvent = typeof ChannelChatMessageEvent.Type

export const Reward = Schema.Struct({
  id: Schema.String.annotations({
    description: "The reward identifier"
  }),
  title: Schema.String.annotations({
    description: "The reward title"
  }),
  cost: Schema.Int.annotations({
    description: "The reward cost"
  }),
  prompt: Schema.String.annotations({
    description: "The reward description"
  })
}).annotations({
  description: "Basic information about the reward that was redeemed, at the time it was redeemed"
})
export type Reward = typeof Reward.Type

export const ChannelPointsCustomRewardRedemptionEvent = Schema.Struct({
  id: Schema.String.annotations({
    description: "The redemption identifier"
  }),
  broadcaster_user_id: Schema.String.annotations({
    description: "The requested broadcaster ID"
  }),
  broadcaster_user_login: Schema.String.annotations({
    description: "The requested broadcaster login"
  }),
  broadcaster_user_name: Schema.String.annotations({
    description: "The requested broadcaster display name"
  }),
  user_id: Schema.String.annotations({
    description: "User ID of the user that redeemed the reward"
  }),
  user_login: Schema.String.annotations({
    description: "Login of the user that redeemed the reward"
  }),
  user_name: Schema.String.annotations({
    description: "Display name of the user that redeemed the reward"
  }),
  user_input: Schema.String.annotations({
    description: "The user input provided(an empty string if not provided)"
  }),
  status: Schema.Literal("unknown", "unfulfilled", "fulfilled", "canceled").annotations({
    description: "The status of the reward redemption"
  }),
  reward: Reward,
  redeemed_at: Schema.DateTimeUtc
}).annotations({
  description: "A notification sent when a viewer has redeemed a custom channel points reward on the specified channel"
})
export type ChannelPointsCustomRewardRedemptionEvent = typeof ChannelPointsCustomRewardRedemptionEvent.Type

export const TwitchEventsubEvent = Schema.Union(
  ChannelChatMessageEvent.pipe(
    Schema.attachPropertySignature("type", "channel.chat.message")
  ),
  ChannelPointsCustomRewardRedemptionEvent.pipe(
    Schema.attachPropertySignature("type", "channel.channel_points_custom_reward_redemption.add")
  )
)
export type TwitchEventsubEvent = typeof TwitchEventsubEvent.Type

export const TwitchEventsubMessageType = Schema.Literal(
  "notification",
  "revocation",
  "webhook_callback_verification"
)
export type TwitchEventsubMessageType = typeof TwitchEventsubMessageType.Type

export const TwitchEventsubRequestHeaders = Schema.Struct({
  "twitch-eventsub-message-id": Schema.String,
  "twitch-eventsub-message-type": TwitchEventsubMessageType,
  "twitch-eventsub-message-timestamp": Schema.String,
  "twitch-eventsub-message-signature": Schema.String
})
export type TwitchEventsubRequestHeaders = typeof TwitchEventsubRequestHeaders.Type

export const TwitchEventsubSubscriptionType = Schema.Literal(
  "channel.chat.message",
  "channel.channel_points_custom_reward_redemption.add"
).annotations({
  description: "The notification’s subscription type"
})
export type TwitchEventsubSubscriptionType = typeof TwitchEventsubSubscriptionType.Type

export const TwitchEventsubSubscription = Schema.Struct({
  id: Schema.String.annotations({
    description: "Your client ID"
  }),
  type: TwitchEventsubSubscriptionType,
  version: Schema.String.annotations({
    description: "The version of the subscription"
  }),
  status: Schema.String.annotations({
    description: "The status of the subscription"
  }),
  cost: Schema.Int.annotations({
    description: "How much the subscription counts against your limit"
  }),
  condition: Schema.Record({
    key: Schema.String,
    value: Schema.String
  }),
  created_at: Schema.DateTimeUtc.annotations({
    description: "The time the notification was created"
  })
})
export type TwitchEventsubSubscription = typeof TwitchEventsubSubscription.Type

export const TwitchEventsubWebhookChallenge = Schema.Struct({
  challenge: Schema.String,
  subscription: TwitchEventsubSubscription
}).pipe(Schema.attachPropertySignature("_tag", "WebhookChallenge"))
export type TwitchEventsubWebhookChallenge = typeof TwitchEventsubWebhookChallenge.Type

export const TwitchEventsubNotification = Schema.Struct({
  subscription: TwitchEventsubSubscription,
  event: TwitchEventsubEvent
}).pipe(Schema.attachPropertySignature("_tag", "Notification"))
export type TwitchEventsubNotification = typeof TwitchEventsubNotification.Type

export const TwitchEventsubRevocation = Schema.Struct({
  subscription: TwitchEventsubSubscription
}).pipe(Schema.attachPropertySignature("_tag", "Revocation"))
export type TwitchEventsubRevocation = typeof TwitchEventsubRevocation.Type

export const TwitchEventsubRequest = Schema.Union(
  TwitchEventsubWebhookChallenge,
  TwitchEventsubNotification,
  TwitchEventsubRevocation
)
export type TwitchEventsubRequest = typeof TwitchEventsubRequest.Type

export const TwitchEventsubSubscriptionResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({
    id: Schema.String,
    type: TwitchEventsubSubscriptionType,
    status: Schema.Literal(
      "enabled",
      "webhook_callback_verification_pending"
    ),
    version: Schema.String,
    cost: Schema.Int,
    condition: Schema.Record({
      key: Schema.String,
      value: Schema.String
    }),
    transport: Schema.Struct({
      method: Schema.Literal("webhook"),
      callback: Schema.String
    }),
    created_at: Schema.DateTimeUtc
  })),
  total: Schema.Int,
  total_cost: Schema.Int,
  max_total_cost: Schema.Int
})
export type TwitchEventsubSubscriptionResponse = typeof TwitchEventsubSubscriptionResponse.Type
