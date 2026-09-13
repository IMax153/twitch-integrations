# 01: Chat Command schemas and the Invocation matcher

**What to build:** In `packages/domain`, the `ChatCommand` schema with `name`, `response`, `status` (Enabled or Disabled), `cooldown`, `cooldownUntil`, and `lastAnsweredAt`; the `ChatCommandName` and `ChatCommandResponse` branded strings with the rules in spec stories 6 and 7; `ChatCommandDraft` for create and edit input with a ten second default Cooldown bounded to zero through one hour; and a pure matcher that takes a message text and the list of Chat Commands and returns the one whose `!name` equals the trimmed text, case-sensitively, or nothing. Every schema carries an identifier annotation.

**Blocked by:** None

**Status:** ready-for-human

- [x] `ChatCommand`, `ChatCommandName`, `ChatCommandResponse`, `ChatCommandDraft`, and `ChatCommandStatus` schemas exist in the domain package with identifier annotations
- [x] A name outside `^[A-Za-z0-9_]{1,32}$` and a response that is empty or over 500 characters are rejected by the schemas
- [x] The matcher answers `!today` and `!today` with the Chat Command, and `!Today`, `!today please`, and `today` with nothing
- [x] The required chat scopes (`user:read:chat`, `user:bot`, `channel:bot`) are one exported constant
- [x] Table tests cover the matcher and the two validation rules as behaviour

## Comments

Grilled on 2026-09-13; see `.scratch/chat-commands/spec.md` and ADR 0003.

Implemented on 2026-09-13 in `packages/domain/src/ChatCommand.ts` with table tests in `packages/domain/test/ChatCommand.test.ts`; `vp check` and the full suite pass. Two decisions for the next tickets: the spec's one `ChatCommandDraft` became two schemas, `NewChatCommand` (name, response, and defaults of Enabled and ten seconds for the create body) and `ChatCommandDraft` (response, Cooldown, and status all required, for the edit body), so that an edit body with an omitted status can never re-enable a Disabled Chat Command by accident. `Cooldown` is its own bounded schema, encoded as whole milliseconds; `defaultCooldown` and `maximumCooldown` are exported for the page. The matcher returns an `Option` and does not consult status or Cooldown, which stay with `ChannelReceive` per the spec. The Provider scope list is untouched; ticket 04 owns it and should import `requiredChatScopes`.
