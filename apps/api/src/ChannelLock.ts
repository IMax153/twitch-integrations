import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Semaphore from "effect/Semaphore"

/**
 * The Channel's one lock. A reconcile, a received notification, and later a
 * Redemption being processed each take its single permit, so none of them
 * ever runs beside another and the Reward's pause state is never written
 * from two sides at once.
 */
export class ChannelLock extends Context.Service<ChannelLock, Semaphore.Semaphore>()(
  "@twitch-integrations/api/ChannelLock",
) {
  static readonly layer: Layer.Layer<ChannelLock> = Layer.effect(ChannelLock)(
    Effect.map(Semaphore.make(1), (lock) => lock),
  )
}
