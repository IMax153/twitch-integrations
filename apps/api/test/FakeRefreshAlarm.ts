import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import { RefreshAlarm, type RefreshAlarmService } from "../src/RefreshAlarm.ts"

export interface FakeRefreshAlarmService {
  /** When the alarm is armed for, or none while it is disarmed. */
  readonly armedFor: Effect.Effect<Option.Option<DateTime.Utc>>
}

const make = Effect.gen(function* () {
  const armed = yield* Ref.make<Option.Option<DateTime.Utc>>(Option.none())
  const alarm: RefreshAlarmService = {
    schedule: (at) => Ref.set(armed, Option.some(at)),
    cancel: Ref.set(armed, Option.none()),
  }
  const service: FakeRefreshAlarmService = { armedFor: Ref.get(armed) }
  return { service, alarm }
})

/**
 * A `RefreshAlarm` that only remembers what it was armed for. It never rings
 * on its own: a test rings the object's alarm handler itself.
 */
export class FakeRefreshAlarm extends Context.Service<FakeRefreshAlarm, FakeRefreshAlarmService>()(
  "@twitch-integrations/api/test/FakeRefreshAlarm",
) {
  /** Both the control service and the `RefreshAlarm` it observes, built together. */
  static readonly layer: Layer.Layer<FakeRefreshAlarm | RefreshAlarm> = Layer.effectContext(
    Effect.map(make, ({ service, alarm }) =>
      Context.make(FakeRefreshAlarm, service).pipe(Context.add(RefreshAlarm, alarm)),
    ),
  )
}
