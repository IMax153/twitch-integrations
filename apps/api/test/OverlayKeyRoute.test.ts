import { assert, describe, it } from "@effect/vitest"
import { IssuedOverlay } from "@twitch-integrations/domain/Overlay"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import {
  broadcasterIdentity,
  makeBroadcasterWorld,
  type SendOptions,
} from "./BroadcasterHarness.ts"

const asBroadcaster = { identity: broadcasterIdentity }

const decodeIssued = Schema.decodeUnknownEffect(IssuedOverlay)

const post = (headers: Record<string, string>, options: SendOptions = asBroadcaster) =>
  Effect.flatMap(makeBroadcasterWorld, (world) =>
    Effect.map(
      world.send(
        new Request("https://worker.example/setup/api/overlay-key", {
          method: "POST",
          headers,
          body: "{}",
        }),
        options,
      ),
      (response) => ({ world, response }),
    ),
  )

describe("POST /setup/api/overlay-key", () => {
  it.effect(
    "issues the key and answers the browser source URL on the request's origin, uncached",
    () =>
      Effect.gen(function* () {
        yield* DateTime.makeUnsafe("2026-09-11T12:00:00Z").pipe(
          DateTime.toEpochMillis,
          TestClock.setTime,
        )
        const { world, response } = yield* post({ "content-type": "application/json" })
        assert.strictEqual(response.status, 201)
        assert.strictEqual(response.headers.get("cache-control"), "no-store")
        const issued = yield* decodeIssued(yield* Effect.promise(() => response.json()))
        const url = new URL(issued.url)
        assert.strictEqual(url.origin, "https://worker.example")
        assert.strictEqual(url.pathname, "/overlay/now-playing")
        const key = url.searchParams.get("key") ?? ""
        assert.match(key, /^[A-Za-z0-9_-]{43}$/)
        assert.deepStrictEqual(issued.issuedAt, DateTime.makeUnsafe("2026-09-11T12:00:00Z"))
        // The Channel now answers to exactly that key.
        yield* world.channel.readNowPlaying(key).pipe(Effect.ignore)
        assert.isTrue(Option.isSome(yield* world.channelStore.readOverlayKey))
      }).pipe(Effect.scoped),
  )

  it.effect("refuses a request without Access, and a form post, without issuing anything", () =>
    Effect.gen(function* () {
      const anonymous = yield* post({ "content-type": "application/json" }, {})
      assert.strictEqual(anonymous.response.status, 403)
      assert.deepStrictEqual(yield* anonymous.world.channelStore.readOverlayKey, Option.none())
      const form = yield* post({ "content-type": "application/x-www-form-urlencoded" })
      assert.strictEqual(form.response.status, 415)
      assert.deepStrictEqual(yield* form.world.channelStore.readOverlayKey, Option.none())
    }).pipe(Effect.scoped),
  )
})
