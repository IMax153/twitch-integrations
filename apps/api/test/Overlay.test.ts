import { assert, describe, it } from "@effect/vitest"
import { NowPlaying } from "@twitch-integrations/domain/Overlay"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import { makeBroadcasterWorld } from "./BroadcasterHarness.ts"
import { authorizedConnection, midnightCity, queuedTracks, spotifyPlaying } from "./fixtures.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso).pipe(DateTime.toEpochMillis, TestClock.setTime)

const decodeNowPlaying = Schema.decodeUnknownEffect(NowPlaying)

/** The world at noon with Spotify authorized, its token fresh, and the player on Midnight City. */
const worldWithSpotify = Effect.gen(function* () {
  const world = yield* makeBroadcasterWorld
  yield* at("2026-09-11T12:00:00Z")
  yield* world.stores.spotify.writeConnection(authorizedConnection)
  yield* world.providers.spotifyWeb.set(spotifyPlaying)
  return world
})

const playerRequests = (world: Effect.Success<typeof worldWithSpotify>) =>
  Effect.map(world.providers.spotifyWeb.received, (requests) =>
    requests.filter((request) => request.url.includes("/v1/me/player")),
  )

describe("Overlay Key", () => {
  it.effect("is issued as a fresh forty-three character key with only its digest stored", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      const first = yield* world.channel.issueOverlayKey()
      const second = yield* world.channel.issueOverlayKey()
      assert.match(first.key, /^[A-Za-z0-9_-]{43}$/)
      assert.notStrictEqual(first.key, second.key)
      assert.strictEqual(second.issuedAt, "2026-09-11T12:00:00.000Z")
      const stored = yield* world.channelStore.readOverlayKey
      assert.isTrue(Option.isSome(stored))
      assert.notInclude(Option.getOrThrow(stored).digest, second.key)
      assert.match(Option.getOrThrow(stored).digest, /^[0-9a-f]{64}$/)
    }).pipe(Effect.scoped),
  )

  it.effect("appears in the monitoring snapshot only as its issue time", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      assert.deepStrictEqual((yield* world.channel.describe()).overlayKey, null)
      const issued = yield* world.channel.issueOverlayKey()
      const snapshot = yield* world.channel.describe()
      assert.deepStrictEqual(snapshot.overlayKey, { issuedAt: "2026-09-11T12:00:00.000Z" })
      assert.notInclude(Object.values(snapshot.overlayKey ?? {}), issued.key)
    }).pipe(Effect.scoped),
  )

  it.effect(
    "is refused before Spotify is asked when it matches nothing, or nothing was issued",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithSpotify
        const before = yield* Effect.result(world.channel.readNowPlaying("A".repeat(43)))
        assert.strictEqual(
          before._tag === "Failure" ? before.failure._tag : "",
          "UnknownOverlayKey",
        )
        const issued = yield* world.channel.issueOverlayKey()
        const wrong = yield* Effect.result(world.channel.readNowPlaying(`${issued.key.slice(1)}A`))
        assert.strictEqual(wrong._tag === "Failure" ? wrong.failure._tag : "", "UnknownOverlayKey")
        const empty = yield* Effect.result(world.channel.readNowPlaying(""))
        assert.strictEqual(empty._tag === "Failure" ? empty.failure._tag : "", "UnknownOverlayKey")
        assert.deepStrictEqual(yield* playerRequests(world), [])
      }).pipe(Effect.scoped),
  )

  it.effect("stops answering to the last key once a new one is issued", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      const first = yield* world.channel.issueOverlayKey()
      yield* world.channel.readNowPlaying(first.key)
      const second = yield* world.channel.issueOverlayKey()
      const stale = yield* Effect.result(world.channel.readNowPlaying(first.key))
      assert.strictEqual(stale._tag === "Failure" ? stale.failure._tag : "", "UnknownOverlayKey")
      yield* world.channel.readNowPlaying(second.key)
    }).pipe(Effect.scoped),
  )
})

describe("Now Playing", () => {
  it.effect(
    "reports the track playing, its progress, and the next four queued with 300px covers",
    () =>
      Effect.gen(function* () {
        const world = yield* worldWithSpotify
        const { key } = yield* world.channel.issueOverlayKey()
        const nowPlaying = yield* decodeNowPlaying(yield* world.channel.readNowPlaying(key))
        assert.deepStrictEqual(nowPlaying, {
          observedAt: DateTime.makeUnsafe("2026-09-11T12:00:00Z"),
          playback: Option.some({
            track: {
              name: "Midnight City",
              artists: ["M83"],
              artworkUrl: Option.some("https://i.scdn.co/image/midnight-300"),
              durationMs: 244_000,
            },
            progressMs: 73_000,
            isPlaying: true,
          }),
          upNext: queuedTracks.slice(0, 4).map((track) => ({
            name: track.name,
            artists: track.artists,
            artworkUrl: Option.none(),
            durationMs: track.durationMs,
          })),
        })
        // Both reads carry the Spotify Connection's token, and nothing else leaves.
        const requests = yield* playerRequests(world)
        assert.deepStrictEqual(
          requests.map((request) => [request.method, new URL(request.url).pathname]),
          [
            ["GET", "/v1/me/player"],
            ["GET", "/v1/me/player/queue"],
          ],
        )
        assert.deepStrictEqual(
          new Set(requests.map((request) => request.headers["authorization"])),
          new Set(["Bearer access-token-1"]),
        )
      }).pipe(Effect.scoped),
  )

  it.effect("reports no playback while no device is active, and skips episodes in the queue", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      const { playback: _playback, ...idle } = spotifyPlaying
      yield* world.providers.spotifyWeb.set({
        ...idle,
        queue: [{ ...midnightCity, type: "episode" }, ...queuedTracks],
      })
      const { key } = yield* world.channel.issueOverlayKey()
      const nowPlaying = yield* decodeNowPlaying(yield* world.channel.readNowPlaying(key))
      assert.deepStrictEqual(nowPlaying.playback, Option.none())
      assert.deepStrictEqual(
        nowPlaying.upNext.map((track) => track.name),
        queuedTracks.slice(0, 4).map((track) => track.name),
      )
    }).pipe(Effect.scoped),
  )

  it.effect("keeps one answer for two seconds so several Overlays cost one read", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      const { key } = yield* world.channel.issueOverlayKey()
      yield* world.channel.readNowPlaying(key)
      yield* world.channel.readNowPlaying(key)
      assert.lengthOf(yield* playerRequests(world), 2)
      yield* TestClock.adjust("3 seconds")
      yield* world.channel.readNowPlaying(key)
      assert.lengthOf(yield* playerRequests(world), 4)
    }).pipe(Effect.scoped),
  )

  it.effect("is unavailable while the Spotify Connection is Not Configured", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      const { key } = yield* world.channel.issueOverlayKey()
      const result = yield* Effect.result(world.channel.readNowPlaying(key))
      if (result._tag === "Failure" && result.failure._tag === "NowPlayingUnavailable") {
        assert.strictEqual(result.failure.reason, "SpotifyUnavailable")
      } else {
        assert.fail("expected NowPlayingUnavailable")
      }
    }).pipe(Effect.scoped),
  )

  it.effect("is unavailable, and never a defect, when Spotify refuses the player read", () =>
    Effect.gen(function* () {
      const world = yield* worldWithSpotify
      yield* world.providers.spotifyWeb.set({
        ...spotifyPlaying,
        playerRefusal: { status: 403, message: "Insufficient client scope" },
      })
      const { key } = yield* world.channel.issueOverlayKey()
      const result = yield* Effect.result(world.channel.readNowPlaying(key))
      if (result._tag === "Failure" && result.failure._tag === "NowPlayingUnavailable") {
        assert.strictEqual(result.failure.reason, "Failed")
      } else {
        assert.fail("expected NowPlayingUnavailable")
      }
    }).pipe(Effect.scoped),
  )
})
