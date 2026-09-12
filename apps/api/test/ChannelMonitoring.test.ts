import { assert, describe, it } from "@effect/vitest"
import { ChannelMonitoring, monitoringLimit } from "@twitch-integrations/domain/ChannelMonitoring"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { broadcasterIdentity, makeBroadcasterWorld } from "./BroadcasterHarness.ts"
import {
  heldRedemptionOf,
  redemptionOf,
  songRequestReward,
  storedSubscriptions,
} from "./fixtures.ts"

describe("Broadcaster Channel monitoring", () => {
  it.effect("refuses unauthenticated monitoring reads", () =>
    Effect.gen(function* () {
      const world = yield* makeBroadcasterWorld
      const response = yield* world.send(new Request("https://worker.example/setup/api/channel"))
      assert.strictEqual(response.status, 403)
    }),
  )

  it.effect(
    "returns an ordered, bounded snapshot without consuming queued or held Redemptions",
    () =>
      Effect.gen(function* () {
        const world = yield* makeBroadcasterWorld
        yield* world.settled
        yield* world.channelStore.writeState("Live")
        yield* world.channelStore.writeReward(songRequestReward)
        yield* world.channelStore.replaceEventSubscriptions(storedSubscriptions)
        yield* Effect.forEach(
          Array.from({ length: monitoringLimit + 2 }, (_, index) => index),
          (index) =>
            world.channelStore.enqueueRedemption(
              redemptionOf("reward-1", `input-${index}`, `queued-${index}`),
            ),
        )
        yield* Effect.forEach(
          Array.from({ length: monitoringLimit + 1 }, (_, index) => index),
          (index) =>
            world.channelStore.holdRedemption(heldRedemptionOf(`held-${index}`, `input-${index}`)),
        )
        const response = yield* world.send(
          new Request("https://worker.example/setup/api/channel"),
          {
            identity: broadcasterIdentity,
          },
        )
        assert.strictEqual(response.status, 200)
        assert.strictEqual(response.headers.get("cache-control"), "no-store")
        const snapshot = yield* Schema.decodeUnknownEffect(ChannelMonitoring)(
          yield* Effect.promise(() => response.json()),
        )
        assert.strictEqual(snapshot.state, "Live")
        assert.deepStrictEqual(snapshot.eventSubscriptions, storedSubscriptions)
        assert.strictEqual(snapshot.processing.total, monitoringLimit + 2)
        assert.strictEqual(snapshot.processing.items.length, monitoringLimit)
        assert.strictEqual(snapshot.processing.items[0]?.id, "queued-0")
        assert.strictEqual(
          snapshot.processing.items[monitoringLimit - 1]?.id,
          `queued-${monitoringLimit - 1}`,
        )
        assert.strictEqual(snapshot.held.total, monitoringLimit + 1)
        assert.strictEqual(snapshot.held.items.length, monitoringLimit)
        assert.strictEqual(snapshot.held.items[0]?.redemption.id, "held-0")
        const again = yield* world.channel.describe()
        assert.strictEqual(again.processing.total, snapshot.processing.total)
        assert.strictEqual(again.held.total, snapshot.held.total)
      }),
  )
})
