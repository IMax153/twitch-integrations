import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { observed } from "@twitch-integrations/infra/Failure"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Latch from "effect/Latch"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Semaphore from "effect/Semaphore"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelStore } from "./ChannelStore.ts"
import { SongRequests } from "./SongRequests.ts"

export interface RedemptionQueueService {
  /** Appends the Redemption to the stored Processing Queue, returning once the append is durable. */
  readonly enqueue: (redemption: Redemption) => Effect.Effect<void>
  /** Starts draining whatever the Processing Queue holds, without waiting for it. */
  readonly kick: Effect.Effect<void>
  /** Returns once every drain started so far has run out of Redemptions to process. */
  readonly settled: Effect.Effect<void>
}

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const lock = yield* ChannelLock
  const { process, retryFulfilments } = yield* SongRequests
  // Drains are forked into the layer's scope, which on the object lives as long as the instance.
  const scope = yield* Effect.scope
  /** One drain at a time; a kick while one runs waits its turn and then finds what was left. */
  const draining = yield* Semaphore.make(1)
  const started = yield* Ref.make(0)
  const idle = yield* Latch.make(true)

  /** Processes the Redemption that has waited longest and takes it out of the queue; whether there was one. */
  const drainOne: Effect.Effect<boolean> = lock.withPermit(
    Effect.gen(function* () {
      const next = yield* store.nextRedemption
      if (Option.isNone(next)) {
        return false
      }
      // Keep songs Spotify accepted for fulfilment recovery. Other processing
      // defects are logged and dropped so they cannot block later Redemptions.
      yield* process(next.value).pipe(observed, Effect.ignoreCause)
      if (!(yield* store.hasQueuedSong(next.value.id))) {
        yield* store.removeRedemption(next.value.id)
      }
      return true
    }),
  )

  /** Processes Redemptions until the queue is empty. */
  const drain: Effect.Effect<void> = Effect.flatMap(drainOne, (more) =>
    more ? drain : Effect.void,
  )

  const finished = Effect.flatMap(
    Ref.updateAndGet(started, (count) => count - 1),
    (count) => (count === 0 ? Effect.asVoid(idle.open) : Effect.void),
  )

  const kick: RedemptionQueueService["kick"] = Effect.gen(function* () {
    yield* Ref.update(started, (count) => count + 1)
    yield* idle.close
    yield* Effect.forkIn(
      draining
        .withPermits(1)(Effect.andThen(lock.withPermit(retryFulfilments), drain))
        .pipe(Effect.ensuring(finished)),
      scope,
    )
  })

  const enqueue: RedemptionQueueService["enqueue"] = Effect.fn("RedemptionQueue.enqueue")(
    function* (redemption) {
      yield* store.enqueueRedemption(redemption)
      yield* Effect.logInfo(`Queued Redemption ${redemption.id} from ${redemption.viewerName}`)
    },
  )

  return RedemptionQueue.of({ enqueue, kick, settled: idle.await })
})

/**
 * The Channel's Processing Queue: Redemptions of the Reward, stored on
 * arrival and processed one at a time in that order under the Channel's
 * lock, on the object itself and after the receiver has been answered.
 */
export class RedemptionQueue extends Context.Service<RedemptionQueue, RedemptionQueueService>()(
  "@twitch-integrations/api/RedemptionQueue",
) {
  static readonly layer: Layer.Layer<
    RedemptionQueue,
    never,
    ChannelStore | ChannelLock | SongRequests
  > = Layer.effect(RedemptionQueue)(make)
}
