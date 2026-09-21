/** The Cloudflare zone the deployment lives in. Registered through Cloudflare Registrar, so it already exists. */
export const zoneName = "minbadblue.com"

/**
 * The host both Workers bind under `alchemy dev`. Spotify accepts a plain
 * HTTP callback only on a loopback IP literal, never `localhost`, so the
 * page is opened at this address and the Workers listen on it explicitly
 * rather than on whatever `localhost` resolves to.
 */
export const devHost = "127.0.0.1"

/**
 * The one hostname both Workers share; paths decide which Worker answers.
 * The name carries no Provider brand on purpose: the previous
 * `twitch-integrations` hostname drew a Safe Browsing lookalike warning on
 * the Spotify authorize route, and both Providers' brand rules discourage
 * their names in domains.
 */
export const broadcasterHostname = "stream.minbadblue.com"

/** A zone route on the broadcaster hostname for the given path pattern. */
export const broadcasterRoute = (pathPattern: `/${string}`) => ({
  pattern: `${broadcasterHostname}${pathPattern}`,
  zoneName,
})

/**
 * The path prefix the receiver owns on the shared hostname: its route, and
 * the path the zone rate limit counts, are both built from it.
 */
export const eventSubRoutePrefix = "/eventsub"

/** The one path on the shared hostname that Twitch delivers EventSub webhook messages to. */
export const eventSubPath = `${eventSubRoutePrefix}/twitch`

/** The callback URL every Event Subscription names: the receiver on the shared hostname. */
export const eventSubCallbackUrl = `https://${broadcasterHostname}${eventSubPath}`

/**
 * The path prefix the overlay Worker owns on the shared hostname: its
 * route, and the path the zone rate limit counts beside the receiver's.
 */
export const overlayRoutePrefix = "/overlay"

/** The one path an Overlay is served from; the Overlay Key travels in its query string. */
export const nowPlayingOverlayPath = `${overlayRoutePrefix}/now-playing`

/** The query parameter an Overlay's URL carries its Overlay Key in. */
export const overlayKeyParameter = "key"

/** The URL the Broadcaster pastes into OBS: the Overlay's path on the given origin, carrying the key. */
export const nowPlayingOverlayUrl = (origin: string, key: string): string => {
  const url = new URL(nowPlayingOverlayPath, origin)
  url.searchParams.set(overlayKeyParameter, key)
  return url.toString()
}
