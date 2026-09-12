# 07: Every failed Song Request refunds the viewer

**What to build:** When a Song Request cannot be completed, the Channel cancels the Redemption, which refunds the viewer's points, and replies in chat with the reason. The outcomes and replies are fixed by the spec: NotATrackLink ("that isn't a Spotify track link, points refunded"), NothingPlaying when Spotify reports no active device ("Spotify isn't playing right now, points refunded"), Offline when the channel is not Live ("song requests are off while the stream is offline, points refunded"), SpotifyUnavailable when the Spotify Connection is Not Configured or Reauthorization Required, and Failed for any other error (both "couldn't add that track, points refunded"). A chat send that fails, or reports the message as not sent, is logged with its drop reason and never changes the outcome. A fulfil that fails after the track was queued is retried three times with short waits, then logged and left unfulfilled rather than cancelled.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Each cancellation reason produces one Update Redemption Status call with CANCELED and one chat reply with the spec's wording, addressed to the viewer by display name
- [ ] A Redemption processed while Offline is cancelled with the Offline reply without any Spotify call
- [ ] A Spotify no-active-device response cancels with NothingPlaying; a Spotify Connection error cancels with SpotifyUnavailable; any other Spotify failure cancels with Failed
- [ ] A track lookup failure after a successful queue add still fulfils, with the link text in the reply
- [ ] A chat send failure or an is_sent false response is logged and the Redemption's outcome is unchanged
- [ ] A fulfil that fails is retried three times under the TestClock, and after the last failure the Redemption is left unfulfilled with a log line, never cancelled
- [ ] Tests cover every outcome through the receiver over the fake APIs

## Comments

Note from ticket 06 (2026-09-12): `SongRequests.process` already decides every cancellation reason (`NotQueued` carries it) and only logs it; this ticket turns that into the cancel call and the reply, with `replyTo` in the domain package already holding the wording. Each Redemption is processed under the `ChannelLock` that `receive` also takes, so the fulfil retries' waits delay the acknowledgement of any notification arriving meanwhile; keep the three waits short enough that their sum stays well inside Twitch's response deadline, or narrow the lock to the Processing Queue reads and the state read.
