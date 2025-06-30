import { Effect } from "effect"
import type * as Api from "../domain/spotify.js"
import { SpotifyClient } from "../spotify/client.js"

export type SongQueue = Array<Api.TrackObject | Api.EpisodeObject>

export class SpotifySongQueue extends Effect.Service<SpotifySongQueue>()("app/SpotifySongQueue", {
  effect: Effect.gen(function*() {
    const spotifyClient = yield* SpotifyClient

    const getQueue = Effect.fn("SpotifySongQueue.getQueue")(() =>
      spotifyClient.getQueue().pipe(
        Effect.map(({ currently_playing, queue }): SongQueue => [
          ...(currently_playing ? [currently_playing] : []),
          ...(queue ?? [])
        ])
      )
    )

    return {
      getQueue
    } as const
  }),
  dependencies: [SpotifyClient.Default]
}) {}

export function isTrackObject(item: SongQueue[number]): item is Api.TrackObject {
  return item.type === "track"
}
