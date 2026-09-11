# Domain docs

This repo uses a single context across its workspace apps and packages.

## Before exploring

- Read `CONTEXT.md` at the repo root.
- Read ADRs in root `docs/adr/` that concern the area being explored.

If these files do not exist, proceed silently. `/domain-modeling` creates
them when terms or decisions are resolved, including through
`/grill-with-docs` and `/improve-codebase-architecture`.

## Layout

- `CONTEXT.md`: shared domain terminology.
- `docs/adr/`: architecture decision records.

## Use the glossary's vocabulary

Use terms as defined in `CONTEXT.md` when naming domain concepts in
issues, proposals, hypotheses, and tests.

If a needed concept is missing, reconsider whether the term belongs.
Record genuine gaps for `/domain-modeling`.

## Flag ADR conflicts

Explicitly identify any existing ADR that a proposal contradicts.
Name the ADR and explain why the decision is worth reopening.
