import { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Schema from "effect/Schema"
import { Runtime } from "foldkit"
import { Flags, Model, init, update, view } from "./main.ts"
import { subscriptions } from "./subscription.ts"

const decodeResult = Schema.decodeUnknownOption(BroadcasterResult)

const flags: Effect.Effect<Flags> = Effect.gen(function* () {
  return {
    maybeResult: decodeResult(new URLSearchParams(window.location.search).get("result")),
    now: yield* Clock.currentTimeMillis,
    isVisible: document.visibilityState === "visible",
  }
})

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById("root"),
})

Runtime.run(application, { flags })
