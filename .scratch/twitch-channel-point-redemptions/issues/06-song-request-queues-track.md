# 06: A Song Request while Live queues the track

**What to build:** A viewer redeems Song Request with a Spotify track link while the channel is Live, and the track lands on the Broadcaster's Spotify queue. The receiver forwards the redemption add notification; the Channel appends it to a stored processing queue and acknowledges as soon as the append is durable. The Channel drains the queue one Redemption at a time in arrival order: parses the input as an `open.spotify.com/track/<id>` URL with any query string ignored or a `spotify:track:<id>` URI, adds the track to the queue through the Spotify Connection's token, looks up the track's name and artists, fulfils the Redemption through the Twitch Connection's token, and replies in chat as the Twitch Connected Account with "@viewer added Track Name by Artist to the queue." This ticket is the happy path only; failures are ticket 07.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Domain schemas for Redemption and RedemptionOutcome exist in the domain package with identifier annotations
- [ ] The input parser accepts both link forms and is tested as a pure function over a table of inputs
- [ ] A redemption add notification for the Reward is durable before the receiver responds 2xx
- [ ] Redemptions are processed one at a time in arrival order, verified by a burst of notifications and the order of fake Spotify queue calls
- [ ] The queue add, the track lookup, the fulfil call, and the chat send each go to the fake API with the expected identifiers, and the chat reply carries the track name and artist
- [ ] The chat send sets sender and broadcaster to the Twitch Connected Account's ID and stays under 500 characters
- [ ] A queue that was left non-empty when the object stopped drains when the object next starts or receives
- [ ] Tests run the whole path from a signed notification through the receiver to the fake Spotify and Helix APIs
