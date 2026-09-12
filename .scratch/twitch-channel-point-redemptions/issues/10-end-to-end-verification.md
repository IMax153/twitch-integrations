# 10: End-to-end verification in production

**What to build:** Prove the whole feature on the deployed `production` stage, in the shape of OAuth ticket 09. Deploy, confirm the receiver's route wins over the API Worker's custom domain and that Access does not challenge it, reconnect Twitch from the Broadcaster Page and watch reconcile create the Song Request Reward and three enabled Event Subscriptions with the real challenge handshake, then exercise the feature live: go Live and see the Reward unpause, redeem Song Request from a second Twitch account with a track link and hear it queue with the chat reply, redeem with a bad link and see the refund and reply, go Offline and see the Reward pause. Record every observation and any surprise on this ticket.

**Blocked by:** 08, 09

**Status:** ready-for-human

- [ ] `alchemy deploy --stage production` completes and the plan shows the receiver Worker, its route, and no change to the Access application
- [ ] An unauthenticated GET to the receiver's route returns the empty 404 rather than an Access login page; a GET to the API Worker still gets Access
- [ ] After reconnecting Twitch, Get Custom Reward shows the Song Request Reward with the spec's settings and Get EventSub Subscriptions shows the three subscriptions enabled
- [ ] Going Live unpauses the Reward in the Twitch dashboard; going Offline pauses it
- [ ] A Song Request with a valid track link while Live queues the track on Spotify, is marked fulfilled, and gets the success chat reply
- [ ] A Song Request with a non-track link is refunded and gets the refund chat reply
- [ ] Observations, timings, and any deviation from the spec are recorded in a comment on this ticket
