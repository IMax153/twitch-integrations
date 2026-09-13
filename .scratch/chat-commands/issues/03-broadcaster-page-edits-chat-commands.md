# 03: The Broadcaster Page creates, edits, disables, and deletes Chat Commands

**What to build:** Three write routes on the API Worker under the existing Access gate: `POST /setup/api/chat-commands`, `PUT /setup/api/chat-commands/:name`, and `DELETE /setup/api/chat-commands/:name`, accepting only JSON bodies, answering 400 for an invalid draft, 409 for a duplicate name, and 404 for an unknown name, each with a small JSON body. A Chat Commands section on the root Broadcaster Page in the same Foldkit program: a list showing name, response, status, and Cooldown with inline editing per row, an add form, an inline delete confirmation, a muted last-answered line, and an immediate refetch of the Channel snapshot after any save. A notice when the Twitch Connection is Authorized but its granted scopes lack any required chat scope, naming the missing ones and telling the Broadcaster to press Connect on Twitch.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The three routes exist under the `/setup` prefix gate, decode drafts through the domain schema, and map each rejection to its status and body
- [ ] The Chat Commands section lists every Chat Command from the snapshot with inline edit, add, disable and enable, and confirmed delete
- [ ] A save triggers an immediate snapshot fetch; a rejection's message is shown next to the form
- [ ] The scope notice appears exactly when the Twitch Connection is Authorized and lacks a required chat scope
- [ ] Route tests cover each rejection and success; story tests cover the list, the notice, and the refetch, following the `foldkit` skill's conventions
- [ ] `docs/adr/0001` and `0002` are unchanged; the section lives on the root page

## Comments
