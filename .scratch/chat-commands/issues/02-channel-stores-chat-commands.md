# 02: The Channel stores Chat Commands and exposes them in the snapshot

**What to build:** A `chat_command` table in the Channel's SQLite keyed by the lowercased name, created with the other tables. Channel object RPC methods `createChatCommand`, `updateChatCommand`, and `deleteChatCommand` taking encoded drafts, running under the Channel lock, clearing `cooldownUntil` on every write, and returning typed rejections for a duplicate name (case-insensitive), an unknown name, or an invalid draft. `ChannelMonitoring` gains a `chatCommands` list so the Broadcaster Page's existing poll carries them.

**Blocked by:** 01

**Status:** ready-for-human

- [x] The store creates the `chat_command` table idempotently and reads and writes Chat Commands as Schema-validated JSON documents
- [x] Creating `Today` after `today` is rejected as a duplicate; editing or deleting an unknown name is rejected
- [x] Editing a Chat Command in Cooldown clears `cooldownUntil` and leaves `lastAnsweredAt` alone, verified under `TestClock`
- [x] Enabling a Disabled Chat Command counts as an edit and clears the Cooldown
- [x] `ChannelMonitoring` includes every Chat Command; the Worker-side `Channel` service wraps the three new RPC methods
- [x] Tests drive the object's methods directly and assert through the snapshot

## Comments

Implemented on 2026-09-13. Storage is `chat_command (name_key, document)` in `apps/api/src/ChannelStore.ts`, keyed by the lowercased name, with `readChatCommands` ordered by that key so the snapshot's list is stable. The writes live in a new `ChatCommands` service (`apps/api/src/ChatCommands.ts`) that takes the Channel lock per call; the object's `createChatCommand`, `updateChatCommand`, and `deleteChatCommand` decode the page's encoded body there, so an invalid draft is `InvalidChatCommandDraft` carrying the Schema message. The rejections are `Schema.TaggedError` classes in `packages/domain/src/ChatCommandErrors.ts`, so ticket 03 can encode them straight into its 400 and 409 bodies; they cross the RPC as plain objects, matched on `_tag`. Two things for ticket 03: `updateChatCommand` takes the name as a separate argument beside the draft, matching the `PUT /:name` route, and `DuplicateChatCommand.name` carries the casing the Broadcaster attempted, not the stored one. Rejected writes are not logged at error level, since they are the Broadcaster's to see on the page; only defects are. The `TestClock` in the Cooldown tests makes the planted `cooldownUntil` genuinely future, but the clear is unconditional, so the clock becomes load-bearing only once ticket 04 checks Cooldowns in `ChannelReceive`. `vp check` and the full suite pass.
