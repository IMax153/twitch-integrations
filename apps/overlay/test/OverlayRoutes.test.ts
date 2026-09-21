import { assert, describe, it } from "@effect/vitest"
import { NowPlaying } from "@twitch-integrations/domain/Overlay"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import { authorizedConnection, spotifyPlaying } from "../../api/test/fixtures.ts"
import { makeOverlayWorld } from "./OverlayHarness.ts"

const origin = "https://stream.example"

const pagePath = "/overlay/now-playing"
const statePath = "/overlay/now-playing/state"

const decodeNowPlaying = Schema.decodeUnknownEffect(NowPlaying)

/** The world at noon with Spotify playing and an Overlay Key issued, and a way to ask the Worker with any key. */
const worldWithKey = Effect.gen(function* () {
  const world = yield* makeOverlayWorld
  yield* DateTime.makeUnsafe("2026-09-11T12:00:00Z").pipe(DateTime.toEpochMillis, TestClock.setTime)
  yield* world.stores.spotify.writeConnection(authorizedConnection)
  yield* world.providers.spotifyWeb.set(spotifyPlaying)
  const { key } = yield* world.channel.issueOverlayKey()
  const get = (path: string, presented: string = key, method = "GET") =>
    world.serve(
      new Request(`${origin}${path}?${new URLSearchParams({ key: presented })}`, { method }),
    )
  return { world, key, get }
})

describe("overlay Worker", () => {
  it.effect("serves the page to the current key, locked down by its headers", () =>
    Effect.gen(function* () {
      const { get } = yield* worldWithKey
      const response = yield* get(pagePath)
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/)
      assert.strictEqual(response.headers.get("cache-control"), "no-store")
      assert.strictEqual(response.headers.get("referrer-policy"), "no-referrer")
      assert.strictEqual(response.headers.get("x-content-type-options"), "nosniff")
      const policy = response.headers.get("content-security-policy") ?? ""
      const nonce = /script-src 'nonce-([^']+)'/.exec(policy)?.[1] ?? ""
      assert.isAbove(nonce.length, 0)
      assert.include(policy, "default-src 'none'")
      assert.include(policy, `style-src 'nonce-${nonce}'`)
      assert.include(policy, "img-src https://i.scdn.co")
      assert.include(policy, "connect-src 'self'")
      assert.include(policy, "frame-ancestors 'none'")
      const html = yield* Effect.promise(() => response.text())
      assert.include(html, `<script nonce="${nonce}">`)
      assert.include(html, `<style nonce="${nonce}">`)
      assert.include(html, 'name="referrer" content="no-referrer"')
      assert.include(html, statePath)
      // A second page gets its own nonce.
      const again = yield* get(pagePath)
      assert.notStrictEqual(again.headers.get("content-security-policy"), policy)
    }).pipe(Effect.scoped),
  )

  it.effect("answers the state to the current key as Now Playing JSON, uncached", () =>
    Effect.gen(function* () {
      const { get } = yield* worldWithKey
      const response = yield* get(statePath)
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
      assert.strictEqual(response.headers.get("cache-control"), "no-store")
      const nowPlaying = yield* decodeNowPlaying(yield* Effect.promise(() => response.json()))
      assert.deepStrictEqual(
        Option.map(nowPlaying.playback, (playback) => playback.track.name),
        Option.some("Midnight City"),
      )
      assert.lengthOf(nowPlaying.upNext, 4)
    }).pipe(Effect.scoped),
  )

  it.effect(
    "answers an empty 404 to a wrong key, a missing key, another path, and another method alike",
    () =>
      Effect.gen(function* () {
        const { world, key, get } = yield* worldWithKey
        const answers = yield* Effect.all([
          get(pagePath, `${key.slice(1)}A`),
          get(statePath, ""),
          world.serve(new Request(`${origin}${pagePath}`)),
          get("/overlay/other"),
          get("/overlay/now-playing/"),
          get(statePath, key, "POST"),
        ])
        for (const response of answers) {
          assert.strictEqual(response.status, 404)
          assert.strictEqual(yield* Effect.promise(() => response.text()), "")
        }
        // Nothing about the wrong keys reached Spotify.
        const player = (yield* world.providers.spotifyWeb.received).filter((request) =>
          request.url.includes("/v1/me/player"),
        )
        assert.deepStrictEqual(player, [])
      }).pipe(Effect.scoped),
  )

  it.effect("still serves the page, and answers the state 503, while Spotify cannot be asked", () =>
    Effect.gen(function* () {
      const { world, get } = yield* worldWithKey
      yield* world.providers.spotifyWeb.set({
        ...spotifyPlaying,
        playerRefusal: { status: 502, message: "Bad gateway" },
      })
      assert.strictEqual((yield* get(pagePath)).status, 200)
      const state = yield* get(statePath)
      assert.strictEqual(state.status, 503)
      assert.strictEqual(yield* Effect.promise(() => state.text()), "")
    }).pipe(Effect.scoped),
  )
})
