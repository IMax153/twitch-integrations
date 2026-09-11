import { ALCHEMY_DEV } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"

/**
 * The Access application both Workers enroll in through their `access` prop.
 * Enrolling a Worker is what makes Cloudflare populate `ctx.access`; a
 * hostname-scoped application admits the request but leaves it empty.
 *
 * Under `alchemy dev` there is no application: the Workers run locally, so
 * nothing could enroll in one, and Cloudflare rejects an application with no
 * destinations. Each Worker's `dev.access` stub stands in for it.
 */
export class BroadcasterAccess extends Context.Service<
  BroadcasterAccess,
  Cloudflare.Access.Application | undefined
>()("@twitch-integrations/infra/BroadcasterAccess") {}

/**
 * The `access` prop enrolling a Worker in the application: nothing under
 * `alchemy dev`, and nothing inside workerd, where a Worker's init runs again
 * over its bindings and the stack's services do not exist. At plan time the
 * application must have been provided, so its absence there is a defect.
 */
export const enrollment: Effect.Effect<{ readonly access: Cloudflare.Access.Application } | {}> =
  Effect.gen(function* () {
    if (globalThis.__ALCHEMY_RUNTIME__) {
      return {}
    }
    const access = yield* Effect.serviceOption(BroadcasterAccess)
    if (Option.isNone(access)) {
      return yield* Effect.die(new Error("BroadcasterAccess was not provided to the Worker init"))
    }
    return access.value === undefined ? {} : { access: access.value }
  })

/** The fixed Access `user_uuid` the simulated Broadcaster carries under `alchemy dev`. */
const devBroadcasterUserUuid = "00000000-0000-4000-8000-000000000001"

/** The Access stub a Worker uses under `alchemy dev`, matching the allowed Broadcaster. */
export const devBroadcasterAccess = {
  aud: "dev",
  identity: {
    email: Config.String("TWITCH_BROADCASTER_EMAIL"),
    user_uuid: devBroadcasterUserUuid,
  },
}

/** The Access resources in the cloud, or nothing under `alchemy dev`. */
export const CloudflareAccess = Effect.gen(function* () {
  if (yield* ALCHEMY_DEV) {
    return undefined
  }
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
    include: [{ email: yield* Config.String("TWITCH_BROADCASTER_EMAIL") }],
    require: [{ loginMethod: githubIdp.identityProviderId }],
  })

  // A hostname-scoped application cannot be converted in place: Cloudflare
  // keeps its `domain` and rejects destinations that omit it. The Worker-scoped
  // application therefore carries its own logical id, and the first deploy
  // replaces the old one. The id keeps the old Operator name on purpose:
  // the domain term is now Broadcaster, but renaming a logical id replaces
  // the deployed application.
  return yield* Cloudflare.Access.Application("OperatorWorkersAccess", {
    type: "self_hosted",
    name: "Twitch Integrations",
    sessionDuration: "1h",
    autoRedirectToIdentity: true,
    allowedIdps: [githubIdp.identityProviderId],
    policies: [allowChannelOwner],
  })
})
