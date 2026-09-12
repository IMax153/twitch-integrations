import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { Subscription } from "foldkit"
import { Message } from "./message.ts"
import type { Model } from "./model.ts"

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  clock: entry(
    { isVisible: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ isVisible: model.isVisible }),
      dependenciesToStream: ({ isVisible }) =>
        isVisible
          ? Stream.tick("1 second").pipe(
              Stream.mapEffect(() =>
                Effect.map(Clock.currentTimeMillis, (now) => Message.TickedClock({ now })),
              ),
            )
          : Stream.empty,
    },
  ),
  visibility: entry(
    {},
    {
      modelToDependencies: () => ({}),
      dependenciesToStream: () =>
        Stream.suspend(() =>
          Stream.fromEventListener(document, "visibilitychange").pipe(
            Stream.mapEffect(() =>
              Effect.gen(function* () {
                const now = yield* Clock.currentTimeMillis
                return Message.UpdatedVisibility({
                  isVisible: document.visibilityState === "visible",
                  now,
                })
              }),
            ),
          ),
        ),
    },
  ),
}))
