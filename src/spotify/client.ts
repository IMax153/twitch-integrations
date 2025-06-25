import { HttpClient, HttpClientRequest } from "@effect/platform"
import { Config, Data, Effect } from "effect"
import * as Api from "../domain/spotify.js"
import { SpotifyAuth } from "./auth.js"

export class SpotifyError extends Data.TaggedError("SpotifyError")<{
  readonly cause: unknown
}> {}

export class SpotifyClient extends Effect.Service<SpotifyClient>()("app/Spotify/Client", {
  effect: Effect.gen(function*() {
    const baseUrl = yield* Config.string("SPOTIFY_API_BASE_URL")

    const auth = yield* SpotifyAuth

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(baseUrl.toString()),
          HttpClientRequest.acceptJson
        )
      ),
      HttpClient.mapRequestEffect(Effect.fnUntraced(function*(request) {
        const { accessToken } = yield* auth.getToken()
        return HttpClientRequest.bearerToken(request, accessToken)
      })),
      HttpClient.filterStatusOk
    )

    return Api.make(httpClient)
  }),
  dependencies: [SpotifyAuth.Default]
}) {}
