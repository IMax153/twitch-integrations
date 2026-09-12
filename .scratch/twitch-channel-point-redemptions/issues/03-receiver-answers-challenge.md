# 03: The receiver Worker answers Twitch's challenge

**What to build:** A third Worker, the receiver, deployed on the `/eventsub*` route of the shared hostname and not enrolled in the Access application, so Twitch can reach it without an Access login. It answers one path with POST and everything else with an empty 404. It refuses bodies over 16 KB before reading them, verifies Twitch's HMAC-SHA256 signature over message ID, timestamp, and raw body with a constant-time compare, refuses timestamps older than ten minutes, and answers a callback verification with the raw challenge as text/plain. Notifications and revocations get a 2xx and are dropped for now. The webhook secret is a configured Credential named `TWITCH_EVENTSUB_SECRET`, listed in the example env file. Under `alchemy dev` the receiver runs on its own strict port and the Twitch CLI's `event verify-subscription` and `event trigger` commands drive it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A new workspace app deploys the receiver on the `/eventsub*` route with workers.dev disabled and no Access enrollment
- [x] The receiver reads `TWITCH_EVENTSUB_SECRET` the way the API Worker reads Provider Credentials, and the example env file lists it
- [x] Any path other than the one webhook path, and any method other than POST on it, returns an empty 404
- [x] A body larger than 16 KB is refused with 413 before it is read
- [x] A missing or mismatched signature returns 403; a timestamp older than ten minutes returns 403
- [x] A callback verification returns 200 with the raw challenge as text/plain
- [x] A notification or revocation with a valid signature returns 2xx
- [x] Tests drive the fetch handler with bodies the test signs, covering every rule above
- [x] The receiver runs under `alchemy dev` on its own port and the Twitch CLI's verify-subscription command succeeds against it; the command is recorded in the app's README or the root README
- [x] The receiver holds no Provider Credentials and no Connection binding

## Comments

Implemented on 2026-09-12 as `apps/eventsub`, a third Worker on the `/eventsub*` route with `workersDev: false` and no Access enrollment, listening on strict port 1338 under `alchemy dev`. The handler in `EventSubRoutes.ts` answers `POST /eventsub/twitch` and nothing else, refuses a declared `Content-Length` over 16 KB before touching the body, verifies the `sha256=` HMAC over message ID, timestamp, and raw body through Web Crypto's constant-time `verify` (`Signature.ts`), refuses timestamps older than ten minutes by Effect's clock, answers a callback verification with the raw challenge as `text/plain`, and acknowledges notifications and revocations with an empty 204. `TWITCH_EVENTSUB_SECRET` is read as `Config.Redacted` in the Worker's runtime Effect (`WebhookSecret.ts`) and listed in `.env.example`. The shared failure logger moved from `apps/api` to `apps/infra/src/Failure.ts` so the receiver does not depend on the API Worker. Tests in `apps/eventsub/test/EventSubRoutes.test.ts` drive the handler with bodies signed by Node's own HMAC and cover every rule. Verified under `alchemy dev` with `twitch event verify-subscription channel.channel_points_custom_reward_redemption.add -F http://127.0.0.1:1338/eventsub/twitch -s <secret>` (valid challenge, `text/plain`, 200), a wrong secret (empty refusal), and `twitch event trigger` for `stream.online` and the redemption add (204); the command is recorded in the root README. The rate-limiting rule is left to ticket 09 as the spec says.
