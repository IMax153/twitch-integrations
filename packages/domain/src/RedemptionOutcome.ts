import * as Schema from "effect/Schema"

/** Why a Redemption was cancelled, each reason answered in chat with its own wording. */
export const CancellationReason = Schema.Literals([
  "NotATrackLink",
  "NothingPlaying",
  "Offline",
  "SpotifyUnavailable",
  "Failed",
]).annotate({ identifier: "CancellationReason" })
export type CancellationReason = typeof CancellationReason.Type

/** The track was queued and the Redemption fulfilled. */
export const Fulfilled = Schema.TaggedStruct("Fulfilled", {}).annotate({ identifier: "Fulfilled" })

/** The Redemption was cancelled, refunding the viewer, for the reason. */
export const Cancelled = Schema.TaggedStruct("Cancelled", { reason: CancellationReason }).annotate({
  identifier: "Cancelled",
})

/** How the deployment ended a Redemption: every one is fulfilled or cancelled. */
export const RedemptionOutcome = Schema.Union([Fulfilled, Cancelled]).annotate({
  identifier: "RedemptionOutcome",
})
export type RedemptionOutcome = typeof RedemptionOutcome.Type
