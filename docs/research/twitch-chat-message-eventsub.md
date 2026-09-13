# Twitch chat over EventSub and Send Chat Message

Checked against the Twitch developer docs on 2026-09-13 for the Chat Commands feature.

## `channel.chat.message` (version 1)

Fires when "any user sends a message to a channel's chat room". Condition: `broadcaster_user_id` and `user_id`, where `user_id` is the user whose token grants the read. Webhook transport with an app access token requires, from the docs: "Requires `user:read:chat` scope from the chatting user. If app access token used, then additionally requires `user:bot` scope from chatting user, and either `channel:bot` scope from broadcaster or moderator status." The docs make no carve-out for the broadcaster being the chatting user, so the Broadcaster's token must grant all three.

Payload fields used by the deployment: `message_id`, `chatter_user_id`, `chatter_user_login`, `chatter_user_name`, `message.text`, `source_broadcaster_user_id` (set when the line came through shared chat from another channel; null otherwise). Other fields: `message_type`, `badges`, `cheer`, `color`, `reply`, `channel_points_custom_reward_id`, `source_message_id`, `source_badges`, `is_source_only`, `message.fragments`.

## Send Chat Message

`POST https://api.twitch.tv/helix/chat/messages`. With a user token the docs list `user:write:chat` and `user:bot`; `sender_id` must match the token's user. `message` is limited to 500 characters. `reply_parent_message_id` makes the message a threaded reply to the named message. The response's `is_sent` and `drop_reason` say whether Twitch delivered it.

## Webhook handling

No delivery rate or source IP ranges are published. Twitch delivers at least once, resends under the same message ID when unsure, revokes a subscription that fails to answer quickly too many times, and recommends storing then acknowledging when processing is slow.
