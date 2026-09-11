import { ALCHEMY_DEV, Stage } from "alchemy"
import * as Effect from "effect/Effect"

/** The one stage that is ever deployed; every deploy targets it. */
export const productionStage = "production"

/** The prefix Alchemy gives per-user dev stages, the only other stages the stack runs under. */
const devStagePrefix = "dev_"

/**
 * Refuses any stage the stack is not meant to run under, before a resource
 * is touched. A mistyped or missing `--stage` would otherwise create a
 * second set of resources, and Alchemy's Access resources recover existing
 * ones by name, so a stray stage can rewrite production's.
 */
export const guardStage: Effect.Effect<void, never, Stage> = Effect.gen(function* () {
  const stage = yield* Stage
  const dev = yield* Effect.orDie(ALCHEMY_DEV)
  const allowed = stage === productionStage || (dev && stage.startsWith(devStagePrefix))
  if (!allowed) {
    return yield* Effect.die(
      new Error(
        `Refusing stage "${stage}": deploys target "${productionStage}" and alchemy dev runs under a "${devStagePrefix}" stage.`,
      ),
    )
  }
})
