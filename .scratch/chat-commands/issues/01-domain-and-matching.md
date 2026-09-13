# 01: Chat Command schemas and the Invocation matcher

**What to build:** In `packages/domain`, the `ChatCommand` schema with `name`, `response`, `status` (Enabled or Disabled), `cooldown`, `cooldownUntil`, and `lastAnsweredAt`; the `ChatCommandName` and `ChatCommandResponse` branded strings with the rules in spec stories 6 and 7; `ChatCommandDraft` for create and edit input with a ten second default Cooldown bounded to zero through one hour; and a pure matcher that takes a message text and the list of Chat Commands and returns the one whose `!name` equals the trimmed text, case-sensitively, or nothing. Every schema carries an identifier annotation.

**Blocked by:** None

**Status:** claimed

- [ ] `ChatCommand`, `ChatCommandName`, `ChatCommandResponse`, `ChatCommandDraft`, and `ChatCommandStatus` schemas exist in the domain package with identifier annotations
- [ ] A name outside `^[A-Za-z0-9_]{1,32}$` and a response that is empty or over 500 characters are rejected by the schemas
- [ ] The matcher answers `!today` and `!today` with the Chat Command, and `!Today`, `!today please`, and `today` with nothing
- [ ] The required chat scopes (`user:read:chat`, `user:bot`, `channel:bot`) are one exported constant
- [ ] Table tests cover the matcher and the two validation rules as behaviour

## Comments

Grilled on 2026-09-13; see `.scratch/chat-commands/spec.md` and ADR 0003.
