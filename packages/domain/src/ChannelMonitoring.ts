import * as Schema from "effect/Schema"
import { ChannelState } from "./ChannelState.ts"
import { EventSubscription } from "./EventSubscription.ts"
import { HeldRedemption, Redemption } from "./Redemption.ts"
import { Reward } from "./Reward.ts"

/** A fixed read bound; totals include entries beyond the returned oldest entries. */
export const monitoringLimit = 50

const ProcessingOverview = Schema.Struct({
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  items: Schema.Array(Redemption).check(Schema.isMaxLength(monitoringLimit)),
}).annotate({ identifier: "ProcessingOverview" })

const HeldOverview = Schema.Struct({
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  items: Schema.Array(HeldRedemption).check(Schema.isMaxLength(monitoringLimit)),
}).annotate({ identifier: "HeldOverview" })

/** Last stored observations, not a live Provider probe. Contains no Credentials or tokens. */
export const ChannelMonitoring = Schema.Struct({
  observedAt: Schema.DateTimeUtcFromString,
  state: ChannelState,
  reward: Schema.OptionFromNullOr(Reward),
  eventSubscriptions: Schema.Array(EventSubscription),
  processing: ProcessingOverview,
  held: HeldOverview,
}).annotate({ identifier: "ChannelMonitoring" })
export type ChannelMonitoring = typeof ChannelMonitoring.Type
export type ChannelMonitoringEncoded = typeof ChannelMonitoring.Encoded
