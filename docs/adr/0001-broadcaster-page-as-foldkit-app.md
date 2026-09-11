---
status: superseded by ADR-0002
---

# The Broadcaster Page is a Foldkit app served by the API Worker

The Broadcaster Page began as an HTML string rendered inside an API Worker route. We decided to build it as a separate Foldkit application in `apps/web`, built by Vite under the `/setup/` base path and shipped as the API Worker's static assets. The Worker routes every request through itself before the asset layer so the Cloudflare Access gate runs first, serves the app shell and its files under `/setup`, and exposes the page's data as JSON under `/setup/api`. One host keeps one Access application, keeps the OAuth form posts and callback redirects same-origin, and keeps Alchemy's Effect-native Worker, which a Vite-built entry cannot host.

## Considered options

- A second Worker deployed with `Cloudflare.Website.Foldkit` and enrolled in the same Access application. Rejected: a second hostname makes the Connect forms and callback redirects cross-origin, and the page would need its own Access destination.
- Foldkit server rendering. Deferred: it ships from `foldkit/experimental/server`, needs a separate server bundle wired into the Effect Worker, and gains little for a single-broadcaster page. Revisit once it leaves experimental.

## Consequences

- Foldkit pins an exact Effect release candidate. The workspace carries a pnpm patch for Foldkit until it publishes rc.113 support (foldkit/foldkit pull request 1366), recorded in `patches/README.md`.
- Frontend work happens in `apps/web` with Foldkit's scene and story tests; the API keeps HTTP tests over a fake assets service.
