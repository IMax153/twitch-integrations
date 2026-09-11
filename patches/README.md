# Alchemy compatibility patches

These patches port Janitor's Alchemy beta.76 fixes to `alchemy@2.0.0-beta.77`, `@alchemy.run/cloudflare-runtime@2.0.0-beta.77`, and their `@distilled.cloud/*@1.0.0-rc.9` dependencies.

- Update Effect Config constructors and replace `Config.mapOrFail` with `Config.mapEffect` for Effect `4.0.0-rc.113`.
- Recognize Docker's "not known" response as a missing resource.
- Bind Effect methods to the underlying Effect in Alchemy's chain proxy and avoid treating the Exit marker as a deferred property access.
- Update CLI constructors in `GlobalFlag`, `Flag`, and `Argument`, and beta.77's Railway dependency to use the renamed Config constructors.

The Alchemy patch covers beta.77's current source, generated JavaScript, and bundled CLI, including Config calls added or moved since beta.76. The runtime and seven existing Distilled patches apply the same changes as Janitor's patches against the updated package versions. The Railway patch is new for beta.77.

`pnpm-workspace.yaml` registers the patches, and `pnpm-lock.yaml` records their hashes. Run `vp install --frozen-lockfile`, `vp check`, and `vp test` to validate installation and the compatibility regression tests. Rebase or remove these patches when upgrading Alchemy or Effect.

Keep `@effect/platform-node` aligned with Effect at rc.113. The rc.112 platform package calls the removed `FileSystem.Size` constructor and fails when the CLI reads file metadata.

The SQL adapters `@effect/sql-sqlite-do` and `@effect/sql-sqlite-node` are pinned to the workspace Effect release, `4.0.0-rc.113`. Keep both aligned with Effect. Upgrading Effect and Alchemy to their latest releases is outside the scope of the Spotify and Twitch OAuth feature.
