/** The Cloudflare zone the deployment lives in. Registered through Cloudflare Registrar, so it already exists. */
export const zoneName = "minbadblue.com"

/** The one hostname both Workers share; paths decide which Worker answers. */
export const operatorHostname = "twitch-integrations.minbadblue.com"

/** A zone route on the operator hostname for the given path pattern. */
export const operatorRoute = (pathPattern: `/${string}`) => ({
  pattern: `${operatorHostname}${pathPattern}`,
  zoneName,
})
