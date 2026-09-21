import { Channel } from "@twitch-integrations/api/Channel"
import { NowPlaying } from "@twitch-integrations/domain/Overlay"
import { nowPlayingOverlayPath, overlayKeyParameter } from "@twitch-integrations/infra/Domain"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import * as Schema from "effect/Schema"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { widgetPage } from "./Widget.ts"

/** The state path the page polls, beside the page's own path. */
export const statePath = `${nowPlayingOverlayPath}/state`

/** Where Spotify serves cover images from, the one host the page may load an image from. */
const artworkHost = "https://i.scdn.co"

const notFound = HttpServerResponse.empty({ status: 404 })

const unavailable = HttpServerResponse.empty({ status: 503 })

/**
 * The headers on every answer that carries something. Nothing is cached, so
 * a rotated key stops working at once and no proxy keeps a page carrying
 * the old one. The page sends no referrer, so the key in its URL never
 * reaches Spotify's image host.
 */
const commonHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
}

/**
 * The page's Content Security Policy: only the inline style and script the
 * page was built with, images only from Spotify, and requests only back to
 * this origin. Nothing may frame it but OBS, which renders it as a top
 * level document, so framing is refused too.
 */
const contentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${artworkHost}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

const nowPlayingJson = HttpServerResponse.schemaJson(Schema.toEncoded(NowPlaying))

/** The key the request presents, or empty when it presents none: an empty key matches nothing. */
const presentedKey = (url: URL): string => url.searchParams.get(overlayKeyParameter) ?? ""

/**
 * The Worker's HTTP handler, built once over the Channel and a `Crypto`
 * for the page's nonce. Two GET paths answer, both only to the current
 * Overlay Key; everything else, including a wrong key, is an empty 404, so
 * a scan learns nothing about whether an Overlay exists.
 */
export const OverlayHttp = Effect.all([Channel, Crypto.Crypto]).pipe(
  Effect.map(([channel, crypto]) => {
    const nonce = Effect.map(crypto.randomBytes(16), Encoding.encodeBase64).pipe(Effect.orDie)
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const url = new URL(request.url, "https://overlay")
      if (request.method !== "GET") {
        return notFound
      }
      if (url.pathname !== nowPlayingOverlayPath && url.pathname !== statePath) {
        return notFound
      }
      const read = yield* Effect.result(channel.readNowPlaying(presentedKey(url)))
      if (read._tag === "Failure") {
        switch (read.failure._tag) {
          case "UnknownOverlayKey":
            return notFound
          case "NowPlayingUnavailable":
            // The key is right but Spotify cannot be asked: the page itself
            // still loads and shows nothing, and the state answer says why.
            return url.pathname === statePath ? unavailable : yield* page(yield* nonce)
        }
      }
      // What the Channel just encoded always serialises, so a failure is a defect.
      return url.pathname === statePath
        ? yield* Effect.orDie(nowPlayingJson(read.success, { headers: commonHeaders }))
        : yield* page(yield* nonce)
    })
  }),
)

const page = (nonce: string) =>
  Effect.succeed(
    HttpServerResponse.html(widgetPage(nonce)).pipe(
      HttpServerResponse.setHeaders({
        ...commonHeaders,
        "content-security-policy": contentSecurityPolicy(nonce),
      }),
    ),
  )
