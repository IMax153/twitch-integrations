import type { CancellationReason, RedemptionOutcome } from "./RedemptionOutcome.ts"

/** Twitch refuses a chat message of this many characters or more; every reply stays under it. */
export const chatMessageLimit = 500

/** A track as the Channel names it in chat: its name and its artists' names, as Spotify reports them. */
export interface Track {
  readonly name: string
  readonly artists: ReadonlyArray<string>
}

/** How a queued track is named in chat: by its name and artists, or, when those are unknown or too long, by its link. */
export interface QueuedTrack {
  readonly description: string
  /** The track's page URL, short enough that a reply naming it always fits. */
  readonly link: string
}

/** The track's page on Spotify, which is what the viewer pasted with the share token and locale stripped. */
export const trackPageLink = (trackId: string): string =>
  `https://open.spotify.com/track/${trackId}`

/** What each cancellation says in chat, after the viewer's name. */
export const cancellationReplies: Record<CancellationReason, string> = {
  NotATrackLink: "that isn't a Spotify track link, points refunded",
  NothingPlaying: "Spotify isn't playing right now, points refunded",
  Offline: "song requests are off while the stream is offline, points refunded",
  SpotifyUnavailable: "couldn't add that track, points refunded",
  Failed: "couldn't add that track, points refunded",
}

export const describeTrack = (track: Track): string =>
  `${track.name} by ${track.artists.join(", ")}`

/**
 * The reply to a viewer whose Redemption ended in the outcome, addressed by
 * display name. A fulfilled reply names the track; one that would reach
 * Twitch's limit names the track's link instead, which always fits.
 */
export const replyTo = (
  viewerName: string,
  outcome: RedemptionOutcome,
  track: QueuedTrack,
): string => {
  if (outcome._tag === "Cancelled") {
    return `@${viewerName} ${cancellationReplies[outcome.reason]}`
  }
  const named = `@${viewerName} added ${track.description} to the queue.`
  return named.length < chatMessageLimit
    ? named
    : `@${viewerName} added ${track.link} to the queue.`
}
