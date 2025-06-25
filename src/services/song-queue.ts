import { Effect } from "effect"
import { SpotifyClient } from "../spotify/client.js"

export class SongQueue extends Effect.Service<SongQueue>()("app/SongQueue", {
  effect: Effect.gen(function*() {
    const spotifyClient = yield* SpotifyClient
    return {} as const
  })
}) {}
