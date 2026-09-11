import { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Runtime } from "foldkit"
import { Flags, Model, init, update, view } from "./main.ts"

const decodeResult = Schema.decodeUnknownOption(BroadcasterResult)

const flags = Effect.sync((): Flags => ({
  maybeResult: decodeResult(new URLSearchParams(window.location.search).get("result")),
}))

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  container: document.getElementById("root"),
})

Runtime.run(application, { flags })
