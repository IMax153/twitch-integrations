import { HttpApi } from "@effect/platform"
import { SpotifyApi } from "./spotify/api.js"
import { TwitchApi } from "./twitch/api.js"

export class ApiV1 extends HttpApi.make("api")
  .add(SpotifyApi)
  .add(TwitchApi)
  .prefix("/v1")
{}
