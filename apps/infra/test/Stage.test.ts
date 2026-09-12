import { assert, describe, it } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { Stage } from "alchemy"
import { guardStage } from "../src/Stage.ts"

/**
 * Runs the guard under the given stage, with `ALCHEMY_DEV` set when asked,
 * and reports whether it let the stack run. Only the guard's own refusal
 * counts as a refusal; any other defect escapes and fails the test.
 */
const admits = (stage: string, options: { readonly dev: boolean } = { dev: false }) =>
  guardStage.pipe(
    Effect.as(true),
    Effect.catchDefect((defect) =>
      defect instanceof Error && defect.message.startsWith(`Refusing stage "${stage}"`)
        ? Effect.succeed(false)
        : Effect.die(defect),
    ),
    Effect.provideService(Stage, stage),
    Effect.provide(
      ConfigProvider.layer(ConfigProvider.fromUnknown({ ALCHEMY_DEV: String(options.dev) })),
    ),
  )

describe("guardStage", () => {
  it.effect("admits the production stage", () =>
    Effect.gen(function* () {
      assert.isTrue(yield* admits("production"))
    }),
  )

  it.effect("admits a dev stage only under alchemy dev", () =>
    Effect.gen(function* () {
      assert.isTrue(yield* admits("dev_maxwellbrown", { dev: true }))
      assert.isFalse(yield* admits("dev_maxwellbrown"))
    }),
  )

  it.effect("admits Alchemy's placeholder stage, which the state commands run under", () =>
    Effect.gen(function* () {
      assert.isTrue(yield* admits("placeholder"))
    }),
  )

  it.effect("refuses any other stage", () =>
    Effect.gen(function* () {
      assert.isFalse(yield* admits("staging"))
      assert.isFalse(yield* admits("prod"))
    }),
  )
})
