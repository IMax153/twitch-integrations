# 09: End-to-end verification locally and in production

**What to build:** The Broadcaster can run the real authorization for both Providers on their machine, then deploy to the existing production stage and see both Connections Authorized on the deployed Broadcaster Page. Registering callback URIs and approving consent are human steps; this ticket carries a checklist for them.

**Blocked by:** 06 (Callback failure outcomes), 08 (Proactive refresh alarm and retry policy)

**Status:** ready-for-agent

- [ ] `.env.example` lists every Credential the Worker and Access application read
- [ ] Root package scripts run `alchemy dev` with no stage and `alchemy deploy --stage production`
- [ ] The README documents local setup, the callback URIs to register, and the deploy command
- [ ] Human steps: register the localhost and workers.dev callback URIs on the Spotify and Twitch developer applications, one application per Provider
- [ ] Human steps: run `alchemy dev`, open the Broadcaster Page, complete consent for both Providers, confirm Authorized with the expected Connected Account
- [ ] Human steps: wait past the refresh threshold locally or shorten expiry via the fake transport and confirm a refresh occurs
- [ ] Deploy to the `production` stage, confirm the Access login is required, complete consent for both Providers, and confirm both Connections show Authorized with next refresh scheduled
- [ ] Any defect found is fixed in this ticket or recorded as a new ticket
