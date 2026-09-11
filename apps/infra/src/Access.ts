import * as Cloudflare from "alchemy/Cloudflare"
import * as Output from "alchemy/Output"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"

export const CloudflareAccess = Effect.gen(function* () {
  const worker = yield* Cloudflare.Worker

  const workersDevDomain = yield* Config.String("CLOUDFLARE_WORKERS_DEV_DOMAIN")
  const clientId = yield* Config.Redacted("CLOUDFLARE_ACCESS_GITHUB_CLIENT_ID")
  const clientSecret = yield* Config.Redacted("CLOUDFLARE_ACCESS_GITHUB_CLIENT_SECRET")

  const githubIdp = yield* Cloudflare.Access.IdentityProvider("GitHubIdentityProvider", {
    type: "github",
    config: {
      clientId: Redacted.value(clientId),
      clientSecret: Redacted.value(clientSecret),
    },
  })

  const allowChannelOwner = yield* Cloudflare.Access.Policy("AllowTwitchChannelOwner", {
    name: "Allow Twitch channel owner",
    decision: "allow",
    include: [{ email: yield* Config.String("TWITCH_CHANNEL_OWNER_EMAIL") }],
    require: [{ loginMethod: githubIdp.identityProviderId }],
  })

  const setupDestination = Output.interpolate`${worker.workerName}.${workersDevDomain}/setup`

  return yield* Cloudflare.Access.Application("OperatorAccess", {
    type: "self_hosted",
    name: "Twitch Integrations",
    domain: setupDestination,
    sessionDuration: "1h",
    autoRedirectToIdentity: true,
    allowedIdps: [githubIdp.identityProviderId],
    policies: [allowChannelOwner],
    destinations: [
      {
        type: "public",
        uri: setupDestination,
      },
      {
        type: "public",
        uri: Output.interpolate`${worker.workerName}.${workersDevDomain}/oauth`,
      },
    ],
  })
})
