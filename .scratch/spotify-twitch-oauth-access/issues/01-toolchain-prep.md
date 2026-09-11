# 01: Toolchain prep: SQL adapter packages and domain package skeleton

**What to build:** The workspace can build a Connection store against Effect's generic `SqlClient` with a Durable Object adapter in production and a Node SQLite adapter in tests, and a shared domain package exists for other apps to import. Nothing user-visible changes yet; `vp check` and `vp test` stay green.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A `packages/domain` workspace package exists, extends the base tsconfig, is added to the workspace references, and imports nothing from Cloudflare or Alchemy
- [ ] It exports `ProviderName` (spotify or twitch) and `ConnectionStatus` (Not Configured, Authorized, Reauthorization Required) as Effect Schemas
- [ ] The api app depends on the domain package and can import those Schemas
- [ ] The Durable Object SQLite and Node SQLite `SqlClient` adapter packages are added to the catalog at the workspace's current Effect release (rc.113), and `vp install` resolves exactly one Effect
- [ ] The Node SQLite adapter runs in a vitest test that opens an in-memory database and executes a trivial query
- [ ] A short note in the patches README records that the adapter packages are pinned to the workspace Effect release; bumping Effect and Alchemy to their latest releases is out of scope for this feature
