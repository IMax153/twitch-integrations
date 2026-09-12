import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelStore } from "../src/ChannelStore.ts"
import { songRequestReward, storedSubscriptions } from "./fixtures.ts"

/** A fresh in-memory database per test, running the real store over it. */
const storeLayer = ChannelStore.layer.pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
)

const withStore = <A, E>(body: (store: ChannelStore["Service"]) => Effect.Effect<A, E>) =>
  Effect.flatMap(ChannelStore, body).pipe(Effect.provide(storeLayer))

describe("ChannelStore", () => {
  it.effect("holds no Reward and is Offline when empty", () =>
    withStore((store) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* store.readReward, Option.none())
        assert.strictEqual(yield* store.readState, "Offline")
        assert.deepStrictEqual(yield* store.readEventSubscriptions, [])
      }),
    ),
  )

  it.effect("reads back the Reward it wrote, replaced on a second write", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.writeReward(songRequestReward)
        assert.deepStrictEqual(yield* store.readReward, Option.some(songRequestReward))
        yield* store.writeReward({ ...songRequestReward, isPaused: true })
        assert.deepStrictEqual(
          yield* store.readReward,
          Option.some({ ...songRequestReward, isPaused: true }),
        )
      }),
    ),
  )

  it.effect("reads back the state it wrote", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.writeState("Live")
        assert.strictEqual(yield* store.readState, "Live")
        yield* store.writeState("Offline")
        assert.strictEqual(yield* store.readState, "Offline")
      }),
    ),
  )

  it.effect("replaces every Event Subscription at once, keeping their order", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.replaceEventSubscriptions(storedSubscriptions)
        assert.deepStrictEqual(yield* store.readEventSubscriptions, storedSubscriptions)
        const [first] = storedSubscriptions
        yield* store.replaceEventSubscriptions([
          { ...first!, revocationReason: Option.some("gone") },
        ])
        assert.deepStrictEqual(yield* store.readEventSubscriptions, [
          { ...first!, revocationReason: Option.some("gone") },
        ])
        yield* store.replaceEventSubscriptions([])
        assert.deepStrictEqual(yield* store.readEventSubscriptions, [])
      }),
    ),
  )
})
