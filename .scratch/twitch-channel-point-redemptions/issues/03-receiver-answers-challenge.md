# 03: The receiver Worker answers Twitch's challenge

**What to build:** A third Worker, the receiver, deployed on the `/eventsub*` route of the shared hostname and not enrolled in the Access application, so Twitch can reach it without an Access login. It answers one path with POST and everything else with an empty 404. It refuses bodies over 16 KB before reading them, verifies Twitch's HMAC-SHA256 signature over message ID, timestamp, and raw body with a constant-time compare, refuses timestamps older than ten minutes, and answers a callback verification with the raw challenge as text/plain. Notifications and revocations get a 2xx and are dropped for now. The webhook secret is a configured Credential named `TWITCH_EVENTSUB_SECRET`, listed in the example env file. Under `alchemy dev` the receiver runs on its own strict port and the Twitch CLI's `event verify-subscription` and `event trigger` commands drive it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A new workspace app deploys the receiver on the `/eventsub*` route with workers.dev disabled and no Access enrollment
- [ ] The receiver reads `TWITCH_EVENTSUB_SECRET` the way the API Worker reads Provider Credentials, and the example env file lists it
- [ ] Any path other than the one webhook path, and any method other than POST on it, returns an empty 404
- [ ] A body larger than 16 KB is refused with 413 before it is read
- [ ] A missing or mismatched signature returns 403; a timestamp older than ten minutes returns 403
- [ ] A callback verification returns 200 with the raw challenge as text/plain
- [ ] A notification or revocation with a valid signature returns 2xx
- [ ] Tests drive the fetch handler with bodies the test signs, covering every rule above
- [ ] The receiver runs under `alchemy dev` on its own port and the Twitch CLI's verify-subscription command succeeds against it; the command is recorded in the app's README or the root README
- [ ] The receiver holds no Provider Credentials and no Connection binding
