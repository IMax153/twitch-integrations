# 03: The Broadcaster Page creates, edits, disables, and deletes Chat Commands

**What to build:** Three write routes on the API Worker under the existing Access gate: `POST /setup/api/chat-commands`, `PUT /setup/api/chat-commands/:name`, and `DELETE /setup/api/chat-commands/:name`, accepting only JSON bodies, answering 400 for an invalid draft, 409 for a duplicate name, and 404 for an unknown name, each with a small JSON body. A Chat Commands section on the root Broadcaster Page in the same Foldkit program: a list showing name, response, status, and Cooldown with inline editing per row, an add form, an inline delete confirmation, a muted last-answered line, and an immediate refetch of the Channel snapshot after any save. A notice when the Twitch Connection is Authorized but its granted scopes lack any required chat scope, naming the missing ones and telling the Broadcaster to press Connect on Twitch.

**Blocked by:** 02

**Status:** done

- [x] The three routes exist under the `/setup` prefix gate, decode drafts through the domain schema, and map each rejection to its status and body
- [x] The Chat Commands section lists every Chat Command from the snapshot with inline edit, add, disable and enable, and confirmed delete
- [x] A save triggers an immediate snapshot fetch; a rejection's message is shown next to the form
- [x] The scope notice appears exactly when the Twitch Connection is Authorized and lacks a required chat scope
- [x] Route tests cover each rejection and success; story tests cover the list, the notice, and the refetch, following the `foldkit` skill's conventions
- [x] `docs/adr/0001` and `0002` are unchanged; the section lives on the root page

## Comments

Implemented on 2026-09-13. The three routes live in `apps/api/src/BroadcasterRoutes.ts` beside the read routes, under the same `/setup` prefix gate: a body that is not `application/json` answers 415, one the schema refuses 400 with the Schema issue's message, a duplicate name 409, an unknown name 404, each as `{ message }`; a create answers 201 with the stored Chat Command and a deletion 204. The Channel's rejections cross the RPC as plain objects and are matched on `_tag`, as the reconcile's are. Route tests in `apps/api/test/BroadcasterRoutes.test.ts` cover each answer through the router with JSON bodies, and the Access gate refusing every write.

The page gains `apps/web/src/chatCommandView.ts`, a full-width Chat Commands section between the overview and the Redemption details: the list (name, response, status, Cooldown, a muted last-answered line), inline edit and delete confirmation per row, Disable and Enable buttons that send the stored response and Cooldown with the new status, and an add form. Every write is a Foldkit Command with args (`CreateChatCommand`, `UpdateChatCommand`, `DeleteChatCommand`) that settles into `SucceededChatCommandWrite` or `FailedChatCommandWrite` carrying the route's message; success closes whatever it came from and issues `FetchChannel` at once, even while a scheduled refresh is in flight, since that one may have read the Channel before the write landed. A refusal is shown by the row it came from, or by the add form, and the typed draft stays. The scope notice reads the Twitch Connection from the Connections data and appears only when it is Authorized and `missingChatScopes` (a new helper in the domain's `ChatCommand.ts`, beside the required list) is non-empty. Story tests cover the writes and the refetch; scene tests cover the list, the notice in all four Connection states, the inline edit and delete, and where a refusal shows. `vp check` and the full suite (315 tests) pass.

Three choices to know about. First, the page validates a row's Cooldown (whole seconds, 0 to 3600) and response length before sending, with its own wording, so the common slips never make a request; the name is left to the route, since the add form's `pattern` and `maxlength` already guide it and the 400 message covers the rest. Second, the notice says "Press Reconnect on the Twitch Connection" because that is the button's label once a Connection exists; ticket 05's second box says Connect and means the same button. Third, while a write is in flight every control in the section is disabled rather than queued, so two writes never overlap; the whole section shares one `isWritingChatCommand` flag.

Not done here: the page was exercised through the scene tests only, not in a browser, so the CSS is unseen. Ticket 05 covers that in production.

