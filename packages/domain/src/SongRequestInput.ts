import * as Schema from "effect/Schema"

/** A Spotify track link the viewer pasted, reduced to the track's ID. */
export const TrackLink = Schema.TaggedStruct("TrackLink", { trackId: Schema.String }).annotate({
  identifier: "TrackLink",
})
export type TrackLink = typeof TrackLink.Type

/** An input that names no Spotify track: anything but a track page URL or a track URI. */
export const NotATrackLink = Schema.TaggedStruct("NotATrackLink", {}).annotate({
  identifier: "NotATrackLink",
})

/** What the Song Request input parser made of the viewer's input. */
export const SongRequestInput = Schema.Union([TrackLink, NotATrackLink]).annotate({
  identifier: "SongRequestInput",
})
export type SongRequestInput = typeof SongRequestInput.Type

const notATrackLink: SongRequestInput = { _tag: "NotATrackLink" }

/** Spotify IDs are base62 strings; a longer or shorter one is refused before it reaches Spotify. */
const trackId = "([0-9A-Za-z]{22})"

/** The URI Spotify's "Copy Spotify URI" share option gives. */
const uri = new RegExp(`^spotify:track:${trackId}$`)

/** The track ID in a track page URL's path, with or without the locale segment Spotify sometimes inserts. */
const trackPath = new RegExp(`^/(?:intl-[a-z]{2}/)?track/${trackId}/?$`)

/** The track page URL, given with or without its scheme, as Spotify's "Copy Song Link" share option gives it. */
const trackPageUrl = (input: string): URL | undefined => {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    return new URL(withScheme)
  } catch {
    return undefined
  }
}

/**
 * Reads the viewer's input as a Spotify track link: a URL on
 * `open.spotify.com` whose path is `/track/<id>`, with any query string
 * ignored, or the URI `spotify:track:<id>`. Everything else is not a track
 * link.
 */
export const parseSongRequestInput = (input: string): SongRequestInput => {
  const trimmed = input.trim()
  const asUri = uri.exec(trimmed)
  if (asUri?.[1] !== undefined) {
    return { _tag: "TrackLink", trackId: asUri[1] }
  }
  const url = trackPageUrl(trimmed)
  if (url === undefined || url.hostname !== "open.spotify.com") {
    return notATrackLink
  }
  const asPath = trackPath.exec(url.pathname)
  return asPath?.[1] === undefined ? notATrackLink : { _tag: "TrackLink", trackId: asPath[1] }
}
