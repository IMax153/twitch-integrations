import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpMiddleware,
  HttpServer,
  HttpServerResponse,
  Url,
  UrlParams
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, Schema } from "effect"
import * as Crypto from "node:crypto"
import { createServer } from "node:http"

const DEFAULT_AUTHORIZATION_SCOPES = [
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-email",
  "user-read-playback-state",
  "user-read-private"
] as const

export class SpotifyApi extends HttpApi.make("api").add(
  HttpApiGroup.make("spotify")
    .add(HttpApiEndpoint.get("authorize")`/authorize`)
    .add(HttpApiEndpoint.get("callback")`/callback`
      .setUrlParams(Schema.Struct({
        code: Schema.String,
        state: Schema.String
      })))
) {}

export const SpotifyHttpLayer = HttpApiBuilder.group(
  SpotifyApi,
  "spotify",
  Effect.fnUntraced(function*(handlers) {
    const clientId = yield* Config.string("SPOTIFY_CLIENT_ID")

    const baseUrl = yield* Url.fromString("https://accounts.spotify.com/authorize")

    function generateCsrfToken(length: number) {
      return Crypto.randomBytes(60).toString("hex").slice(0, length)
    }

    return handlers
      .handle(
        "authorize",
        Effect.fnUntraced(function*() {
          const csrfToken = generateCsrfToken(16)

          const redirectUrl = Url.setUrlParams(
            baseUrl,
            UrlParams.fromInput({
              response_type: "code",
              client_id: clientId,
              state: csrfToken,
              scope: DEFAULT_AUTHORIZATION_SCOPES.join(" "),
              redirect_uri: "http://127.0.0.1:8080/callback"
            })
          )

          return HttpServerResponse.redirect(redirectUrl)
        })
      )
      .handle(
        "callback",
        Effect.fnUntraced(function*({ urlParams: { code } }) {
          yield* Effect.log("Successfully authorized with the Spotify API").pipe(
            Effect.annotateLogs({ authorizationCode: code })
          )

          return HttpServerResponse.text("ok", { status: 200 })
        }, Effect.catchAll(() => HttpServerResponse.empty({ status: 500 })))
      )
  })
)

const ApiLayer = HttpApiBuilder.api(SpotifyApi).pipe(
  Layer.provide(SpotifyHttpLayer)
)

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLayer),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 8080 }))
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
