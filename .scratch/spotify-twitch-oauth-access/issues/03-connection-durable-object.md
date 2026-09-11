# 03: Connection Durable Object with real storage

**What to build:** Each Provider has a Durable Object instance holding its Connection and Authorization Attempts in SQLite, and the Broadcaster Page reads each Provider's status from it. The store runs unchanged in production over Durable Object storage and in tests over in-memory Node SQLite.

**Blocked by:** 02 (Broadcaster Page skeleton)

**Status:** done

- [x] The domain package gains `Connection`, `ConnectedAccount`, `AuthorizationAttempt`, and `BroadcasterIdentity` Schemas plus tagged domain errors, with tokens as Redacted values
- [x] One Durable Object class, declared with Alchemy's Effect-native constructor, is yielded in the Worker init and addressed by Provider name
- [x] A `ConnectionStore` service written against `SqlClient` stores the Connection as one Schema-validated JSON row and Authorization Attempts in a table with real columns
- [x] Attempt consumption is a single conditional UPDATE matching state, Provider, callback URI, Broadcaster identity, unconsumed, and unexpired, and reports whether a row was consumed
- [x] Tables are created idempotently on first use
- [x] The production `SqlClient` layer wraps the raw Durable Object SQL storage handle; the test layer uses the Node adapter with an in-memory database
- [x] The DO exposes a `describe` RPC returning what the Broadcaster Page needs
- [x] A Worker-side Connections service wraps the DO namespace RPC in production and is provided by the in-process DO implementation in tests
- [x] The Broadcaster Page shows the status returned by `describe`
- [x] Store tests cover reading an empty store, writing and reading a Connection, creating an attempt, consuming it once, refusing a second consume, and refusing an expired or mismatched consume

## Comments

Implemented on 2026-09-11. `packages/domain` gained `Connection`, `ConnectedAccount`, `AuthorizationAttempt`, `BroadcasterIdentity`, and the `ConnectionNotConfigured` and `ReauthorizationRequired` tagged errors. Tokens decode to `Redacted` and encode to plain strings, times to ISO 8601, and absent values to null, so the Connection round-trips as one JSON document.

`apps/api/src/ConnectionStore.ts` is the store over the generic `SqlClient`: idempotent DDL when the layer builds, the Connection as one JSON row, Attempts in a table with real columns and epoch-millisecond times, and consumption as one conditional `UPDATE ... RETURNING`. Storage failures and undecodable rows are defects. `apps/api/src/ConnectionObject.ts` holds `makeConnectionObject`, the object's behavior over the store, and the Alchemy class that wraps it over the Durable Object SQLite adapter on `state.storage.sql.raw`; the object reads its Provider from its own name. `apps/api/src/Connections.ts` is the Worker-side service, `Connections.live` wrapping the namespace stub; the route layer receives it through `HttpRouter.provideRequest`, since route handlers run per request rather than in the handler's build context. The test harness builds one in-process object per Provider over Node in-memory SQLite and exposes the stores so a test can arrange a Connection before any route creates one.

`describe` returns the existing `ConnectionSummary` (Provider and status); the Connected Account, scopes, and expiry the page shows from ticket 05 onward are left to that ticket. `alchemy plan --stage production` from the worktree shows `[Worker/ConnectionObject] create` and no other resource changes. Neither `alchemy dev` nor a deploy has exercised the object under workerd; that remains for ticket 09.

Review follow-up: annotated the derived Schemas, derived the harness's Access identity from the shared Broadcaster fixture, and stopped a Connection document that fails to decode from echoing itself into the defect. Glossary gap for `/domain-modeling`: the code introduces "Attempt claim" (what a callback presents to consume an Attempt) and "Connections" (the Worker's view of every Provider's object), neither of which `CONTEXT.md` names yet.
