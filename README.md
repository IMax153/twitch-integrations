# Twitch integrations

A single-broadcaster Cloudflare deployment that connects one Spotify account and one Twitch account and acts on their behalf during a stream. The Broadcaster manages the two Connections from a Broadcaster Page behind Cloudflare Access. See [CONTEXT.md](CONTEXT.md) for the vocabulary.

## Setup

Use Node.js from `.node-version` and the pnpm version pinned in `package.json`. With Nix and direnv installed, run `direnv allow` to enter the development shell.

```sh
vp install
vp check
vp test
```

Installation patches the TypeScript and Oxlint tooling through `@effect/tsgo` and applies the Alchemy compatibility patches described in [patches/README.md](patches/README.md).

### Credentials

Copy `.env.example` to `.env` and fill in every value. The same file serves local development and deployment.

| Variable                                                                       | Where it comes from                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_ACCESS_GITHUB_CLIENT_ID`, `CLOUDFLARE_ACCESS_GITHUB_CLIENT_SECRET` | The GitHub OAuth application Cloudflare Access signs the Broadcaster in with.                                      |
| `TWITCH_BROADCASTER_EMAIL`                                                     | The one email the Access policy admits. Under `alchemy dev` it is also the simulated Access identity.              |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                                   | The Spotify developer application. One application serves local and production; register both callback URIs on it. |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`                                     | The Twitch developer application. One application serves local and production; register both callback URIs on it.  |

Alchemy's own Cloudflare login lives outside the repo, in `~/.alchemy`. If it is missing, connect Cloudflare to the default profile once per machine:

```sh
pnpm exec alchemy profile edit
```

### Callback URIs to register

The Worker builds each Provider's callback URI from the origin the browser used plus the fixed path `/oauth/<provider>/callback`, so the registered URIs must match the origins you will open. Register these on each Provider's developer application:

| Provider | Local                                          | Production                                             |
| -------- | ---------------------------------------------- | ------------------------------------------------------ |
| Spotify  | `http://127.0.0.1:5173/oauth/spotify/callback` | `https://stream.minbadblue.com/oauth/spotify/callback` |
| Twitch   | `http://127.0.0.1:5173/oauth/twitch/callback`  | `https://stream.minbadblue.com/oauth/twitch/callback`  |

Spotify accepts plain HTTP only for loopback IP literals, so open the local page at `127.0.0.1` rather than `localhost`. If Twitch's console rejects the loopback literal, register `http://localhost:5173/oauth/twitch/callback` instead and open the page at `localhost` when authorizing Twitch.

## Local development

```sh
vp run dev
```

This runs `alchemy dev` on the stack in `alchemy.run.ts` with no stage flag, so Alchemy uses its per-user dev stage and local Durable Object storage, separate from production. The dev stage creates no Cloudflare Access resources; each Worker's simulated Access identity stands in for them. Two local servers start:

- The API Worker on `127.0.0.1:1337`, with a simulated Access identity for `TWITCH_BROADCASTER_EMAIL`.
- The Broadcaster Page on `127.0.0.1:5173`, which proxies `/setup/api` and `/oauth` to the API Worker.

Open `http://127.0.0.1:5173/setup`, press Connect for each Provider, and complete consent. The page should show each Connection as Authorized with the expected Connected Account, the token expiry, and the next scheduled refresh. If a Provider reports a redirect URI mismatch, the origin the API Worker derived differs from the one you registered; the proxy in `apps/web/vite.config.ts` is where to look.

### Verifying a refresh locally

A refresh is scheduled five minutes before the access token expires. Twitch access tokens last a few hours and Spotify's last one hour, so either leave the dev server running until the next refresh time shown on the page passes and reload, or drive the lifecycle in tests instead: `apps/api/test/ConnectionObject.test.ts` runs the alarm handler under a test clock through every refresh outcome without reaching a live Provider.

## Deployment

```sh
vp run deploy
```

This runs `alchemy deploy --stage production`. The stack has only ever been deployed under the `production` stage, and it refuses any other stage name except the `dev_` stages `alchemy dev` uses, so a mistyped stage fails before touching Cloudflare. After a deploy:

1. Open `https://stream.minbadblue.com/setup` in a private window and confirm Cloudflare Access asks you to sign in with GitHub.
2. Sign in as the Broadcaster, press Connect for each Provider, and complete consent.
3. Confirm both Connections show Authorized with the expected Connected Account and a next refresh time.

The deployed shape is described in [ADR 0002](docs/adr/0002-two-workers-on-one-custom-domain.md).

## Workspace

- `apps/api` is the API Worker: the OAuth routes, the Connection Durable Object, and the JSON the page reads.
- `apps/web` is the Broadcaster Page, a Foldkit application built under `/setup/`.
- `apps/infra` holds the Cloudflare Access application and the shared hostname.
- `packages/domain` holds the Effect Schemas shared by the apps.
- `tools/*` contains workspace tools.

New packages should extend `tsconfig.base.json` and be added to the references in `tsconfig.workspace.json`. Use `catalog:` for shared dependencies. Effect is pinned to `4.0.0-rc.113`; the remaining catalog entries support development tooling.

Vite+ configuration lives in `vite.config.ts`. Run project scripts and tasks with `vp run <name>`. The pre-commit hook runs `vp staged`; after initializing Git, enable it with:

```sh
git config core.hooksPath .vite-hooks
```
