<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

Run project commands through `vp run <name>` rather than invoking package scripts or their underlying tools directly.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Task-specific guidance

Read the matching documents before starting each kind of work. Load additional documents as the task expands.

| When working on                                              | Read                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exploring the codebase or changing domain concepts           | [Domain docs](docs/agents/domain.md)                                                                                                                               |
| Writing, changing, or reviewing tests; deciding what to test | [Testing](docs/agents/testing.md)                                                                                                                                  |
| Defining, changing, or reviewing Effect Schemas              | [Schemas](docs/agents/schemas.md)                                                                                                                                  |
| Defining or providing Effect services and layers             | [Effect services and layers](docs/agents/effect.md)                                                                                                                |
| Creating, fetching, or updating issues                       | [Issue tracker](docs/agents/issue-tracker.md)                                                                                                                      |
| Triaging issues                                              | [Triage labels](docs/agents/triage-labels.md)                                                                                                                      |
| Working on the Broadcaster Page in `apps/web` (Foldkit)      | The `foldkit` skill, and `generate-program` or `audit-program` for its architecture and conventions; [ADR 0002](docs/adr/0002-two-workers-on-one-custom-domain.md) |

Keep rules and patterns in focused documents under `docs/agents/`. When adding a topic, add a pointer here with a concrete condition for reading it.
