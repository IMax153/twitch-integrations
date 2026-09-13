# 02: The Channel stores Chat Commands and exposes them in the snapshot

**What to build:** A `chat_command` table in the Channel's SQLite keyed by the lowercased name, created with the other tables. Channel object RPC methods `createChatCommand`, `updateChatCommand`, and `deleteChatCommand` taking encoded drafts, running under the Channel lock, clearing `cooldownUntil` on every write, and returning typed rejections for a duplicate name (case-insensitive), an unknown name, or an invalid draft. `ChannelMonitoring` gains a `chatCommands` list so the Broadcaster Page's existing poll carries them.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The store creates the `chat_command` table idempotently and reads and writes Chat Commands as Schema-validated JSON documents
- [ ] Creating `Today` after `today` is rejected as a duplicate; editing or deleting an unknown name is rejected
- [ ] Editing a Chat Command in Cooldown clears `cooldownUntil` and leaves `lastAnsweredAt` alone, verified under `TestClock`
- [ ] Enabling a Disabled Chat Command counts as an edit and clears the Cooldown
- [ ] `ChannelMonitoring` includes every Chat Command; the Worker-side `Channel` service wraps the three new RPC methods
- [ ] Tests drive the object's methods directly and assert through the snapshot

## Comments
