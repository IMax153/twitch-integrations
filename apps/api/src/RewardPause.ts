import type { ChannelState } from "@twitch-integrations/domain/ChannelState"
import type { Reward } from "@twitch-integrations/domain/Reward"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChannelStore } from "./ChannelStore.ts"
import { Helix, type HelixRequestFailed } from "./Helix.ts"
import type { TwitchAccessGrant } from "./TwitchAccess.ts"

export interface RewardPauseService {
  /**
   * Sets the Reward's pause state on Twitch from the Channel's state, paused
   * while Offline and unpaused while Live, and stores the state Twitch
   * reports back.
   */
  readonly applyState: (
    grant: TwitchAccessGrant,
    reward: Reward,
    state: ChannelState,
  ) => Effect.Effect<Reward, HelixRequestFailed>
}

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const helix = yield* Helix
  const applyState: RewardPauseService["applyState"] = Effect.fn("RewardPause.applyState")(
    function* (grant, reward, state) {
      const updated = yield* helix.updateReward(grant.token, grant.account, reward.id, {
        isPaused: state === "Offline",
      })
      const stored: Reward = { ...reward, isPaused: updated.isPaused }
      yield* store.writeReward(stored)
      return stored
    },
  )
  return RewardPause.of({ applyState })
})

/** The one rule both reconcile and a stream notification apply: the Reward is paused exactly while Offline. */
export class RewardPause extends Context.Service<RewardPause, RewardPauseService>()(
  "@twitch-integrations/api/RewardPause",
) {
  static readonly layer: Layer.Layer<RewardPause, never, ChannelStore | Helix> =
    Layer.effect(RewardPause)(make)
}
