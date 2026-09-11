# Issue tracker: local Markdown

Issues and specs live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Specs: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01`, one file per ticket.
- Record triage state in a `Status:` line near the top of each issue.
  Use the strings in `triage-labels.md`.
- Append comments and conversation history under `## Comments`.

## Publishing and fetching

When a skill says "publish to the issue tracker", create the appropriate
spec or ticket file using the paths above. Create directories as needed.

When a skill says "fetch the relevant ticket", read the referenced file.
If a ticket number matches multiple features, ask which feature.

## Wayfinding operations

Used by `/wayfinder`.

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far, and Fog.
- Child ticket: `.scratch/<effort>/issues/<NN>-<slug>.md`, numbered from `01`,
  with the question in the body.
- Type: record `research`, `prototype`, `grilling`, or `task` in a `Type:` line.
- Status: wayfinding tickets use `open`, `claimed`, or `resolved` rather
  than triage roles.
- Blocking: record dependencies in `Blocked by: NN, NN` near the top.
  A ticket is unblocked when every listed ticket is `resolved`.
- Frontier: choose the lowest-numbered open, unblocked ticket.
- Claim: set `Status: claimed` and save before starting work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`,
  then append a summary and link to Decisions-so-far in the map.
