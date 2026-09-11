/** The Cloudflare zone the deployment lives in. Registered through Cloudflare Registrar, so it already exists. */
export const zoneName = "minbadblue.com"

/** The one hostname both Workers share; paths decide which Worker answers. */
export const broadcasterHostname = "twitch-integrations.minbadblue.com"

/** A zone route on the broadcaster hostname for the given path pattern. */
export const broadcasterRoute = (pathPattern: `/${string}`) => ({
  pattern: `${broadcasterHostname}${pathPattern}`,
  zoneName,
})
