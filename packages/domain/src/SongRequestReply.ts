import type { CancellationReason, RedemptionOutcome } from "./RedemptionOutcome.ts"

/** Twitch refuses a chat message longer than this many characters. */
export const chatMessageLimit = 500

/** What each cancellation says in chat, after the viewer's name. */
export const cancellationReplies: Record<CancellationReason, string> = {
  NotATrackLink: "that isn't a Spotify track link, points refunded",
  NothingPlaying: "Spotify isn't playing right now, points refunded",
  Offline: "song requests are off while the stream is offline, points refunded",
  SpotifyUnavailable: "couldn't add that track, points refunded",
  Failed: "couldn't add that track, points refunded",
}

/** How a track is named in chat: its name and its artists, as Spotify reports them. */
export const describeTrack = (track: {
  readonly name: string
  readonly artists: ReadonlyArray<string>
}): string => `${track.name} by ${track.artists.join(", ")}`

/**
 * The reply to a viewer whose Redemption ended in the outcome, addressed by
 * display name. A fulfilled reply names the track; one that would pass
 * Twitch's limit names the link the viewer pasted instead, which always fits.
 */
export const replyTo = (
  viewerName: string,
  outcome: RedemptionOutcome,
  track: { readonly description: string; readonly link: string },
): string => {
  if (outcome._tag === "Cancelled") {
    return `@${viewerName} ${cancellationReplies[outcome.reason]}`
  }
  const named = `@${viewerName} added ${track.description} to the queue.`
  return named.length <= chatMessageLimit
    ? named
    : `@${viewerName} added ${track.link} to the queue.`
}
