import { HttpApi } from "@effect/platform"
import { TwitchApi } from "./twitch/api.js"

export class ApiV1 extends HttpApi.make("api")
  .add(TwitchApi)
  .prefix("/v1")
{}
