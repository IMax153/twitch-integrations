import * as Cloudflare from "alchemy/Cloudflare"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export interface RefreshAlarmService {
  /** Arms the object's one alarm for the time, replacing whatever it was armed for. */
  readonly schedule: (at: DateTime.Utc) => Effect.Effect<void>
  /** Disarms the alarm, if it is armed. */
  readonly cancel: Effect.Effect<void>
}

const make = Effect.gen(function* () {
  const state = yield* Cloudflare.DurableObjectState
  // NOTE: the raw storage handle rather than Alchemy's wrapper: the wrapper's
  // calls need Alchemy's runtime context, which the lifecycle does not have
  // when a token request or the alarm itself schedules the next refresh.
  const storage = state.raw.storage
  return RefreshAlarm.of({
    schedule: (at) => Effect.promise(() => storage.setAlarm(DateTime.toEpochMillis(at))),
    cancel: Effect.promise(() => storage.deleteAlarm()),
  })
})

/**
 * The Durable Object's single alarm, used for the moment the next refresh
 * runs. Tests substitute a fake that records the armed time.
 */
export class RefreshAlarm extends Context.Service<RefreshAlarm, RefreshAlarmService>()(
  "@twitch-integrations/api/RefreshAlarm",
) {
  static readonly layer: Layer.Layer<RefreshAlarm, never, Cloudflare.DurableObjectState> =
    Layer.effect(RefreshAlarm)(make)
}
