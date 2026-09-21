import * as Schema from "effect/Schema"

/**
 * The bytes of entropy in an Overlay Key. Thirty-two bytes is far beyond
 * what a guess could cover, and its base64url form fits comfortably in a
 * browser source URL.
 */
export const overlayKeyBytes = 32

/**
 * The secret in an Overlay's URL, as the Broadcaster Page shows it once
 * and OBS carries it: base64url without padding, forty-three characters
 * for thirty-two bytes. Nothing stores this form; the Channel keeps only
 * its digest.
 */
export const OverlayKey = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/))
  .pipe(Schema.brand("OverlayKey"))
  .annotate({ identifier: "OverlayKey" })
export type OverlayKey = typeof OverlayKey.Type

/**
 * What the Channel remembers of its Overlay Key for the Broadcaster Page:
 * when the current one was issued. The key itself is never in a snapshot.
 */
export const OverlayKeyIssue = Schema.Struct({
  issuedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "OverlayKeyIssue" })
export type OverlayKeyIssue = typeof OverlayKeyIssue.Type

/** The Overlay Key as the Channel hands it over the RPC, this once, with when it was issued. */
export const IssuedOverlayKey = Schema.Struct({
  key: OverlayKey,
  issuedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "IssuedOverlayKey" })
export type IssuedOverlayKey = typeof IssuedOverlayKey.Type
export type IssuedOverlayKeyEncoded = typeof IssuedOverlayKey.Encoded

/**
 * What the API answers when the Broadcaster issues an Overlay Key: the
 * whole browser source URL, shown once, and when it was issued.
 */
export const IssuedOverlay = Schema.Struct({
  url: Schema.String,
  issuedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "IssuedOverlay" })
export type IssuedOverlay = typeof IssuedOverlay.Type
export type IssuedOverlayEncoded = typeof IssuedOverlay.Encoded

/** A track as the Overlay shows it: its name, its artists, and its cover image when Spotify has one. */
export const OverlayTrack = Schema.Struct({
  name: Schema.String,
  artists: Schema.Array(Schema.String),
  artworkUrl: Schema.OptionFromNullOr(Schema.String),
  durationMs: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}).annotate({ identifier: "OverlayTrack" })
export type OverlayTrack = typeof OverlayTrack.Type

/** The track Spotify is on, how far into it, and whether it is paused. */
export const Playback = Schema.Struct({
  track: OverlayTrack,
  progressMs: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  isPlaying: Schema.Boolean,
}).annotate({ identifier: "Playback" })
export type Playback = typeof Playback.Type

/** How many upcoming tracks the Overlay cycles through. */
export const upNextLimit = 4

/**
 * What the Overlay shows: the Spotify Connected Account's playback, or none
 * while nothing is playing, and the next tracks in its queue. Holds no
 * token and nothing about the Broadcaster; a leaked Overlay Key exposes
 * exactly this.
 */
export const NowPlaying = Schema.Struct({
  observedAt: Schema.DateTimeUtcFromString,
  playback: Schema.OptionFromNullOr(Playback),
  upNext: Schema.Array(OverlayTrack).check(Schema.isMaxLength(upNextLimit)),
}).annotate({ identifier: "NowPlaying" })
export type NowPlaying = typeof NowPlaying.Type
export type NowPlayingEncoded = typeof NowPlaying.Encoded
