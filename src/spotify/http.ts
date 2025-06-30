import { FileSystem, HttpApiBuilder, HttpServerResponse } from "@effect/platform"
import { Array, Config, Effect, Layer, pipe } from "effect"
import { ApiV1 } from "../api.js"
import { isTrackObject, SpotifySongQueue } from "../services/song-queue.js"
import { SongQueueResponse, Track } from "./api.js"

export const SpotifyHttpLayer = HttpApiBuilder.group(
  ApiV1,
  "spotify",
  Effect.fnUntraced(function*(handlers) {
    const fs = yield* FileSystem.FileSystem
    const widgetFileName = yield* Config.string("SPOTIFY_WIDGET_FILE_NAME").pipe(
      Config.withDefault("../static/spotify-song-queue-widget.html")
    )
    const widgetHtml = yield* Effect.orDie(fs.readFileString(widgetFileName, "utf-8"))

    const { getQueue } = yield* SpotifySongQueue
    const encodeSongQueueResponse = HttpServerResponse.schemaJson(SongQueueResponse)

    return handlers
      .handle(
        "song-queue",
        Effect.fnUntraced(function*() {
          const tracks = pipe(
            yield* getQueue(),
            Array.filter(isTrackObject),
            Array.take(5),
            Array.map((track) =>
              new Track({
                name: track.name ?? "",
                artists: (track.artists ?? []).map((artist) => artist.name ?? ""),
                album: {
                  name: track.album?.name ?? "",
                  artwork: (track.album?.images ?? []).map((image) => image.url)[0] ?? ""
                }
              }, { disableValidation: true })
            )
          )
          return yield* encodeSongQueueResponse({
            current: tracks[0],
            next: tracks.slice(1)
          })
        }, Effect.orDie)
      )
      .handle("song-widget", () => HttpServerResponse.html(widgetHtml))
  })
).pipe(Layer.provide(SpotifySongQueue.Default))
