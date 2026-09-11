# 03: Connection Durable Object with real storage

**What to build:** Each Provider has a Durable Object instance holding its Connection and Authorization Attempts in SQLite, and the Operator Page reads each Provider's status from it. The store runs unchanged in production over Durable Object storage and in tests over in-memory Node SQLite.

**Blocked by:** 02 (Operator Page skeleton)

**Status:** ready-for-agent

- [ ] The domain package gains `Connection`, `ConnectedAccount`, `AuthorizationAttempt`, and `OperatorIdentity` Schemas plus tagged domain errors, with tokens as Redacted values
- [ ] One Durable Object class, declared with Alchemy's Effect-native constructor, is yielded in the Worker init and addressed by Provider name
- [ ] A `ConnectionStore` service written against `SqlClient` stores the Connection as one Schema-validated JSON row and Authorization Attempts in a table with real columns
- [ ] Attempt consumption is a single conditional UPDATE matching state, Provider, callback URI, Operator identity, unconsumed, and unexpired, and reports whether a row was consumed
- [ ] Tables are created idempotently on first use
- [ ] The production `SqlClient` layer wraps the raw Durable Object SQL storage handle; the test layer uses the Node adapter with an in-memory database
- [ ] The DO exposes a `describe` RPC returning what the Operator Page needs
- [ ] A Worker-side Connections service wraps the DO namespace RPC in production and is provided by the in-process DO implementation in tests
- [ ] The Operator Page shows the status returned by `describe`
- [ ] Store tests cover reading an empty store, writing and reading a Connection, creating an attempt, consuming it once, refusing a second consume, and refusing an expired or mismatched consume
