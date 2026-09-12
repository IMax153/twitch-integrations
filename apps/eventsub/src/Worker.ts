import { broadcasterRoute, devHost } from "@twitch-integrations/infra/Domain"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { EventSubHttp } from "./EventSubRoutes.ts"
import { WebhookSecret } from "@twitch-integrations/infra/WebhookSecret"

/**
 * The port the receiver listens on under `alchemy dev`, next to the API
 * Worker's 1337. Strict, so a collision fails at startup rather than moving
 * the receiver away from the address the Twitch CLI is pointed at.
 */
const devPort = 1338

/**
 * The receiver: the one public Worker, on the `/eventsub*` route of the
 * shared hostname, where Twitch delivers EventSub webhook messages. It never
 * enrolls in the Access application, so Twitch reaches it without a login;
 * a route takes precedence over the API Worker's custom domain on the same
 * hostname. Its only configuration is the webhook secret: no Provider
 * Credentials, no Connection binding, and no workers.dev URL.
 */
export default class EventSubWorker extends Cloudflare.Worker<EventSubWorker>()(
  "EventSub",
  Effect.succeed({
    main: import.meta.url,
    routes: [broadcasterRoute("/eventsub*")],
    workersDev: false,
    dev: { host: devHost, port: devPort, strictPort: true },
  }),
  Effect.gen(function* () {
    // Read here, in the runtime Effect, so Alchemy binds the secret onto the
    // Worker at plan time and resolves it from that binding at runtime.
    yield* observed(WebhookSecret.config)
    // The Worker's init is its entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    const fetch = yield* EventSubHttp.pipe(Effect.provide(WebhookSecret.layer))
    return { fetch: observed(fetch) }
  }),
) {}
