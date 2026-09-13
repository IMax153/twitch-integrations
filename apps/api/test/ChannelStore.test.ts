import { assert, describe, it } from "@effect/vitest"
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelStore } from "../src/ChannelStore.ts"
import {
  chatCommandOf,
  heldRedemptionOf,
  redemptionOf,
  songRequestReward,
  storedSubscriptions,
} from "./fixtures.ts"

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

describe("ChannelStore processing queue", () => {
  const redemption = (id: string) => redemptionOf("reward-1", `spotify:track:${id}`, id)

  it.effect("hands Redemptions back oldest first and drops each once removed", () =>
    withStore((store) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* store.nextRedemption, Option.none())
        yield* store.enqueueRedemption(redemption("redemption-1"))
        yield* store.enqueueRedemption(redemption("redemption-2"))
        yield* store.enqueueRedemption(redemption("redemption-3"))
        assert.deepStrictEqual(yield* store.nextRedemption, Option.some(redemption("redemption-1")))
        yield* store.removeRedemption("redemption-1")
        assert.deepStrictEqual(yield* store.nextRedemption, Option.some(redemption("redemption-2")))
        yield* store.removeRedemption("redemption-2")
        yield* store.removeRedemption("redemption-3")
        assert.deepStrictEqual(yield* store.nextRedemption, Option.none())
      }),
    ),
  )

  it.effect("keeps a Redemption enqueued twice once, in its first position", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.enqueueRedemption(redemption("redemption-1"))
        yield* store.enqueueRedemption(redemption("redemption-2"))
        yield* store.enqueueRedemption(redemption("redemption-1"))
        yield* store.removeRedemption("redemption-1")
        assert.deepStrictEqual(yield* store.nextRedemption, Option.some(redemption("redemption-2")))
        yield* store.removeRedemption("redemption-2")
        assert.deepStrictEqual(yield* store.nextRedemption, Option.none())
      }),
    ),
  )
})

describe("ChannelStore held Redemptions", () => {
  const held = (id: string) => heldRedemptionOf(id, `spotify:track:${id}`)

  it.effect("hands held Redemptions back in arrival order and forgets each once released", () =>
    withStore((store) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* store.readHeldRedemptions, [])
        yield* store.holdRedemption(held("redemption-2"))
        yield* store.holdRedemption(held("redemption-1"))
        assert.deepStrictEqual(yield* store.readHeldRedemptions, [
          held("redemption-2"),
          held("redemption-1"),
        ])
        yield* store.releaseHeldRedemption("redemption-2")
        assert.deepStrictEqual(yield* store.readHeldRedemptions, [held("redemption-1")])
        yield* store.releaseHeldRedemption("redemption-1")
        assert.deepStrictEqual(yield* store.readHeldRedemptions, [])
      }),
    ),
  )

  it.effect("keeps a Redemption held twice once, in its first position", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.holdRedemption(held("redemption-1"))
        yield* store.holdRedemption(held("redemption-2"))
        yield* store.holdRedemption(held("redemption-1"))
        assert.deepStrictEqual(yield* store.readHeldRedemptions, [
          held("redemption-1"),
          held("redemption-2"),
        ])
      }),
    ),
  )
})

describe("ChannelStore chat commands", () => {
  it.effect("lists Chat Commands by name and finds one by any casing of its name", () =>
    withStore((store) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* store.readChatCommands, [])
        yield* store.writeChatCommand(chatCommandOf("today"))
        yield* store.writeChatCommand(chatCommandOf("Discord"))
        assert.deepStrictEqual(yield* store.readChatCommands, [
          chatCommandOf("Discord"),
          chatCommandOf("today"),
        ])
        assert.deepStrictEqual(
          yield* store.readChatCommand("TODAY"),
          Option.some(chatCommandOf("today")),
        )
        assert.deepStrictEqual(yield* store.readChatCommand("tomorrow"), Option.none())
      }),
    ),
  )

  it.effect("replaces a Chat Command written again under its name and forgets a deleted one", () =>
    withStore((store) =>
      Effect.gen(function* () {
        yield* store.writeChatCommand(chatCommandOf("today"))
        yield* store.writeChatCommand({ ...chatCommandOf("today", "Rust"), status: "Disabled" })
        assert.deepStrictEqual(yield* store.readChatCommands, [
          { ...chatCommandOf("today", "Rust"), status: "Disabled" },
        ])
        yield* store.deleteChatCommand("Today")
        assert.deepStrictEqual(yield* store.readChatCommands, [])
      }),
    ),
  )
})
