import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export class Track extends Schema.Class<Track>("app/Spotify/Api/Track")({
  name: Schema.String,
  artists: Schema.Array(Schema.String),
  album: Schema.Struct({
    name: Schema.String,
    artwork: Schema.String
  })
}) {}

export class SongQueueResponse extends Schema.Class<SongQueueResponse>(
  "app/Spotify/Api/SongQueueResponse"
)({
  current: Track,
  next: Schema.Array(Track)
}) {}

export class SpotifyApi extends HttpApiGroup.make("spotify")
  .add(
    HttpApiEndpoint.get("song-queue")`/song-queue`
      .addSuccess(SongQueueResponse)
      .prefix("/spotify")
  )
  .add(
    HttpApiEndpoint.get("song-widget")`/song-widget`
      .prefix("/spotify")
  )
{}
