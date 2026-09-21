import * as Schema from "effect/Schema"

/** The Overlay Key presented matches none the Channel issued, or none has been issued. */
export class UnknownOverlayKey extends Schema.TaggedError<UnknownOverlayKey>()(
  "UnknownOverlayKey",
  {},
) {}

/**
 * Why the Overlay has nothing to show: the Spotify Connection is Not
 * Configured or needs reauthorization, or Spotify could not be asked.
 */
export class NowPlayingUnavailable extends Schema.TaggedError<NowPlayingUnavailable>()(
  "NowPlayingUnavailable",
  { reason: Schema.Literals(["SpotifyUnavailable", "Failed"]) },
) {}
