# Chat Commands from the Broadcaster Page

Status: draft

## Problem statement

The deployment already speaks in chat as the Twitch Connected Account, but only to answer Song Requests. The Broadcaster wants viewers to be able to type `!today` and be told what the stream is working on, and to be able to add and change such replies from the Broadcaster Page during a stream without touching a third-party bot. Nothing reads chat today: the Channel's three Event Subscriptions cover Redemptions and stream state, and the Broadcaster Page has no write routes at all.

## Solution

A Chat Command is a named, fixed-text reply the Broadcaster defines on the Broadcaster Page. The Channel gains a fourth Event Subscription, `channel.chat.message`, delivered through the existing receiver, and answers an Invocation with a threaded reply as the Twitch Connected Account. Each Chat Command has a Cooldown and is Enabled or Disabled. Reading chat needs two new Twitch scopes, so the feature completes only after the Broadcaster authorizes Twitch again; until then the page says so. ADR 0003 records the transport choice and the forced re-authorization.

## User stories

### Defining Chat Commands

1. As a Broadcaster, I want to create a Chat Command with a name and a response on the Broadcaster Page, so that `!today` exists without me leaving the page.
2. As a Broadcaster, I want to edit a Chat Command's response and Cooldown in place, so that updating what I am working on takes seconds.
3. As a Broadcaster, I want to disable a Chat Command without deleting it and enable it again later, so that a seasonal reply keeps its text.
4. As a Broadcaster, I want to delete a Chat Command after confirming, so that a stray click does not remove one.
5. As a Broadcaster, I want a second Chat Command whose name differs only by case to be rejected, so that viewers are never confused about which reply they will get.
6. As a Broadcaster, I want a name that contains anything other than letters, digits, and underscores, or that is empty or longer than 32 characters, to be rejected, so that every Chat Command is something a viewer can type.
7. As a Broadcaster, I want a response longer than 500 characters, or empty, to be rejected, so that Twitch never drops a reply for its length.
8. As a Broadcaster, I want a new Chat Command to start Enabled with a ten second Cooldown, so that the common case needs only a name and a response.
9. As a Broadcaster, I want the Cooldown editable from zero to one hour, so that a command that must never be spammed and one that may be repeated freely are both possible.

### Answering in chat

10. As a viewer, I want a message that is exactly `!today` to be answered with the Broadcaster's response, so that I learn what the stream is about.
11. As a viewer, I want the answer to be a reply to my message, so that I can tell it was for me.
12. As a viewer, I want `!Today` and `!today please` to be ignored, so that the Broadcaster's exact rule holds and nobody triggers a reply by accident.
13. As a Broadcaster, I want my own `!today` answered, so that I can check a Chat Command on stream.
14. As a Broadcaster, I want a Chat Command to answer at most once per Cooldown, so that ten viewers typing it at once produce one reply.
15. As a Broadcaster, I want any edit to a Chat Command, including enabling it, to end its running Cooldown, so that a corrected reply can be checked at once.
16. As a Broadcaster, I want a Disabled Chat Command to be ignored, so that disabling it is enough to silence it.
17. As a Broadcaster, I want messages that reach my chat from another channel during a shared chat session to be ignored, so that my replies never land in a room I am not hosting.
18. As a Broadcaster, I want Chat Commands answered whether the channel is Live or Offline, so that a viewer in an offline chat still gets the reply I left.
19. As a Broadcaster, I want a reply that cannot be sent, because the Twitch Connection cannot supply a token or Twitch dropped the message, to be logged and forgotten with no Cooldown started, so that chat trouble never costs anything and the next Invocation gets another chance.
20. As a Broadcaster, I want a chat message that invokes nothing to be acknowledged without being stored, so that chat volume never fills storage.
21. As a Broadcaster, I want a resent notification for an answered Invocation to be ignored, so that Twitch's at-least-once delivery never produces two replies.

### Scopes and subscriptions

22. As a Broadcaster, I want the Twitch authorization to ask for the chat scopes Twitch requires, so that a single reconnect enables Chat Commands.
23. As a Broadcaster, I want the reconcile to create the chat Event Subscription only once the Twitch Connection carries those scopes, and to keep the other three working either way, so that an old authorization degrades gracefully.
24. As a Broadcaster, I want the Chat Commands section to tell me when the Twitch Connection lacks the chat scopes, so that I know why a defined Chat Command is silent and what to do.

### Watching it work

25. As a Broadcaster, I want the Chat Commands section to list every Chat Command with its name, response, status, and Cooldown, so that I can see what viewers can type.
26. As a Broadcaster, I want each Chat Command to show, unobtrusively, when it last answered, so that I can tell it is working without a log.

### Development and testing

27. As a developer, I want the Twitch CLI's chat message trigger to drive the local receiver end to end, so that an Invocation can be exercised without a public callback.
28. As a developer, I want the matching, Cooldown, and validation rules tested as behaviour with no workerd, so that the test loop stays fast.

## Implementation decisions

### Domain model

- `packages/domain` gains `ChatCommand`: `name`, `response`, `status` (Enabled or Disabled), `cooldown` as a Duration, `cooldownUntil` (Option), and `lastAnsweredAt` (Option). Two timestamps because editing clears the Cooldown but must not erase the display of when it last answered.
- `ChatCommandName` is a branded string matching `^[A-Za-z0-9_]{1,32}$`, stored as typed. Uniqueness across Chat Commands is case-insensitive.
- `ChatCommandResponse` is a non-empty string of at most 500 characters.
- An Invocation matches when the chat message text, trimmed of leading and trailing whitespace, equals `!` followed by the name, compared case-sensitively. The matcher is a pure function in the domain package over the list of Chat Commands and a message text, returning the matched Chat Command or nothing.
- `ChatCommandDraft` is the create and edit input: `name` on create, `response`, `cooldown`, `status`.

### Storage and the Channel object

- A `chat_command` table in the Channel's SQLite, one row per Chat Command, keyed by the lowercased name with the JSON document beside it, created idempotently with the other tables.
- The Channel object gains RPC methods `createChatCommand`, `updateChatCommand`, `deleteChatCommand`, each taking the encoded draft and returning the encoded result or a typed rejection (duplicate name, unknown name, invalid draft). Every write runs under the Channel lock and clears `cooldownUntil`.
- `ChannelMonitoring` gains `chatCommands`, the full list, so the page's existing ten second poll shows them. The list is small by construction and has no limit.

### Notifications

- `EventSubscriptionType` gains `channel.chat.message`; `eventSubscriptionRequests` gains it with condition `{broadcaster_user_id, user_id}` both set to the Twitch Connected Account, version 1.
- The reconcile asks the Twitch Connection for its granted scopes and includes the chat request only when `user:read:chat`, `user:bot`, and `channel:bot` are all present; otherwise it logs that the chat Event Subscription was skipped. Deleting and recreating the other three is unchanged.
- The receiver decodes `channel.chat.message` into a `ChatMessage` event carrying `messageId`, `chatterUserId`, `chatterLogin`, `chatterDisplayName`, `text`, and `sourceBroadcasterUserId` (Option). `NotificationEvent` gains the variant; the exhaustive switches in `Notifications.eventOf` and `ChannelReceive.act` gain a branch.
- `ChannelReceive` handles a `ChatMessage` under the lock: it returns false without a write when `sourceBroadcasterUserId` is present and differs from the Connected Account, when no Chat Command matches, when the match is Disabled, or when the match is in Cooldown. Otherwise it stamps `cooldownUntil` and `lastAnsweredAt`, records the message ID, and returns true. Message ID dedupe therefore covers only answered Invocations, which satisfies stories 20 and 21.
- The reply is sent after the lock is released and before the receiver is acknowledged: one Helix `chat/messages` call with `reply_parent_message_id` set to the invoking message ID, `sender_id` and `broadcaster_id` set to the Connected Account. If the token is unavailable or `is_sent` is false, the failure is logged and the Chat Command's `cooldownUntil` is cleared so no Cooldown stands, per story 19.
- Live and Offline are not consulted.

### Scopes

- The Twitch `ProviderDescription` scope list gains `user:bot` and `channel:bot`. The existing comment stands: the change takes effect on the next authorization.
- The required chat scopes are a single exported constant used by the reconcile and by the page's notice.

### Broadcaster Page and API routes

- Three routes under the existing Access gate: `POST /setup/api/chat-commands`, `PUT /setup/api/chat-commands/:name`, `DELETE /setup/api/chat-commands/:name`. Bodies are JSON decoded through the draft schema; a rejection returns 400 or 409 with a small JSON body the page can show. The routes accept only `application/json`, which with the same-origin page and Access cookie is the cross-site guard.
- A new Chat Commands section on the root page, in the same Foldkit program: a list with inline editing per row and an add form at the bottom. Saving issues the write, then refetches the Channel snapshot at once rather than waiting for the ten second tick. Delete asks for confirmation inline. The last answered time is a muted secondary line.
- The section shows a notice when the Twitch Connection is Authorized but its granted scopes lack any of the required chat scopes, naming the missing scopes and telling the Broadcaster to press Connect on Twitch.

### Local development

- The Twitch CLI (1.1.25) cannot trigger `channel.chat.message`, so `node --env-file=.env apps/eventsub/scripts/chat-message.ts '!today'` signs and sends one to the local receiver instead (ticket 04 found this). The local Channel skips the chat Event Subscription as it skips the others.

## Testing decisions

- The matcher and the validation schemas are tested as pure functions over tables: exact match, case mismatch, trailing words, surrounding whitespace, invalid names, over-long responses.
- The receiver's fetch handler, signed by the test, drives Invocations end to end against the fake Helix chat endpoint: answered, Disabled, in Cooldown, from a shared chat source, no match, resend of an answered message, drop with `is_sent` false, and Twitch Connection Reauthorization Required. Assertions are on what the fake endpoint received and on the snapshot's timestamps.
- The Channel object's RPC methods are driven directly: create, duplicate name differing by case, edit clearing a running Cooldown under `TestClock`, delete, and the snapshot carrying the list.
- The reconcile is tested with and without the chat scopes present on the fake Twitch Connection, asserting which Event Subscriptions the fake EventSub endpoint received.
- The Broadcaster routes are tested through the router with JSON bodies for each rejection and success.
- The page is covered by story tests in the shape of the monitoring stories: the list, the notice, and the immediate refetch after a save.

## Out of scope

- Placeholders or templating in responses, such as the viewer's name or the current track.
- Restricting who may invoke a Chat Command.
- Chat Commands that do anything other than reply with text.
- A log of Invocations or viewer names.
- A separate bot account.
- Renaming a Chat Command; delete and recreate.
- Pausing Chat Commands while Offline.
- Any other chat feature, including moderation, timers, or reading chat for Song Requests.
- The WebSocket and Conduit EventSub transports (ADR 0003).

## Further notes

- Send Chat Message's docs list `user:bot` for user tokens, which today's Song Request replies work without. Adding it is harmless and is requested anyway for the read.
- `docs/research/twitch-chat-message-eventsub.md` records the scope, payload, and delivery facts this spec relies on.
- The Chat Commands section is the Broadcaster Page's first write surface. Nothing about Access changes: the routes sit under the same `/setup` prefix gate as the read routes.
