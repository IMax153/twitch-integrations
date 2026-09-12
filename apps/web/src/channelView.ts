import type { ChannelMonitoring } from "@twitch-integrations/domain/ChannelMonitoring"
import type { Redemption } from "@twitch-integrations/domain/Redemption"
import { SongRequestReadiness } from "@twitch-integrations/domain/SongRequestReadiness"
import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { HtmlBuilder } from "foldkit/html"
import { Message } from "./message.ts"
import type { Model } from "./model.ts"
import { elapsed, freshnessView, isOutdated } from "./monitoringView.ts"

const readinessView = (channel: ChannelMonitoring, model: Model, h: HtmlBuilder<Message>) => {
  const maybeConnections = AsyncData.getData(model.connections)
  if (
    isOutdated(model.channel, model.maybeChannelCheckedAt, model.now) ||
    isOutdated(model.connections, model.maybeConnectionsCheckedAt, model.now) ||
    Option.isNone(maybeConnections)
  ) {
    return h.div(
      [],
      [
        h.p([h.Class("headline-state")], ["Readiness unconfirmed"]),
        h.p(
          [h.Class("muted")],
          ["Current Channel and Connection data are needed to check readiness."],
        ),
      ],
    )
  }
  const readiness = SongRequestReadiness.evaluate(channel, maybeConnections.value, model.now)
  return h.div(
    [],
    [
      h.p(
        [
          h.Class("headline-state"),
          h.DataAttribute("tone", readiness._tag === "Ready" ? "success" : "warning"),
        ],
        [readiness._tag === "Ready" ? "No observed blockers" : "Needs attention"],
      ),
      readiness._tag === "Ready"
        ? h.p(
            [h.Class("muted")],
            ["Reward and Event Subscriptions are enabled. Spotify playback has not been checked."],
          )
        : h.details(
            [
              h.Open(model.isReadinessOpen),
              h.OnToggle((isOpen) => Message.ToggledReadiness({ isOpen })),
            ],
            [
              h.summary(
                [],
                [
                  `${readiness.reasons.length} ${readiness.reasons.length === 1 ? "blocker" : "blockers"} · View reasons`,
                ],
              ),
              h.ul(
                [h.Class("reasons disclosure-body")],
                Array.map(readiness.reasons, (reason) => h.keyed("li")(reason, [], [reason])),
              ),
            ],
          ),
    ],
  )
}

export const songRequestsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("song-requests"), h.AriaLabel("Song Requests")],
    [
      h.h2([], ["Song Requests"]),
      Option.match(AsyncData.getData(model.channel), {
        onNone: () =>
          h.p(
            [h.Class("headline-state")],
            [AsyncData.isPending(model.channel) ? "Checking readiness…" : "Readiness unavailable"],
          ),
        onSome: (channel) =>
          h.div(
            [],
            [
              readinessView(channel, model, h),
              h.dl(
                [h.Class("channel-facts")],
                [
                  h.div(
                    [h.Class("detail-row")],
                    [h.dt([], ["Channel"]), h.dd([], [channel.state])],
                  ),
                  h.div(
                    [h.Class("detail-row")],
                    [
                      h.dt([], ["Reward"]),
                      h.dd(
                        [],
                        [
                          Option.match(channel.reward, {
                            onNone: () => "Not configured",
                            onSome: (reward) => (reward.isPaused ? "Paused" : "Enabled"),
                          }),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
      }),
      freshnessView(model.channel, model.maybeChannelCheckedAt, model.now, h),
    ],
  )

export const processingView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("processing-panel"), h.AriaLabel("Processing")],
    [
      h.h2([], ["Processing"]),
      Option.match(AsyncData.getData(model.channel), {
        onNone: () =>
          h.p(
            [h.Class("headline-state")],
            [
              AsyncData.isPending(model.channel)
                ? "Checking processing…"
                : "Processing unavailable",
            ],
          ),
        onSome: (channel) =>
          h.div(
            [],
            [
              isOutdated(model.channel, model.maybeChannelCheckedAt, model.now)
                ? h.p([h.Class("warning-text")], ["Stale snapshot · Counts may have changed."])
                : h.empty,
              h.dl(
                [h.Class("processing-counts")],
                [
                  h.div(
                    [h.Class("detail-row")],
                    [
                      h.dt([], ["In Processing Queue"]),
                      h.dd([], [String(channel.processing.total)]),
                    ],
                  ),
                  h.div(
                    [h.Class("detail-row")],
                    [
                      h.dt([], ["Held Redemptions"]),
                      h.dd(
                        [h.Class(channel.held.total > 0 ? "warning-text" : "")],
                        [String(channel.held.total)],
                      ),
                    ],
                  ),
                ],
              ),
              Option.match(Array.head(channel.processing.items), {
                onNone: () => h.p([h.Class("muted")], ["No Redemptions waiting."]),
                onSome: (redemption) =>
                  h.p(
                    [h.Class("muted")],
                    [
                      `Oldest queued Redemption: ${elapsed(DateTime.toEpochMillis(redemption.redeemedAt), model.now)} since redemption.`,
                    ],
                  ),
              }),
              channel.held.total > 0
                ? h.p(
                    [h.Class("warning-text")],
                    ["Held Redemptions await cancellation. Refunds are not yet confirmed."],
                  )
                : h.p([h.Class("muted")], ["No Held Redemptions."]),
            ],
          ),
      }),
      h.p([h.Class("muted")], ["The Processing Queue is separate from the Spotify queue."]),
    ],
  )

const redemptionView = (redemption: Redemption, now: number, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("redemption-content")],
    [
      h.div(
        [h.Class("redemption-heading")],
        [
          h.strong([], [redemption.viewerName]),
          h.span(
            [h.Class("muted")],
            [`${elapsed(DateTime.toEpochMillis(redemption.redeemedAt), now)} ago`],
          ),
        ],
      ),
      h.p([h.Class("redemption-input")], [redemption.input]),
      h.p([h.Class("muted redemption-id")], [`Redemption ${redemption.id}`]),
    ],
  )

const processingDetailsView = (channel: ChannelMonitoring, model: Model, h: HtmlBuilder<Message>) =>
  h.details(
    [h.Open(model.isQueueOpen), h.OnToggle((isOpen) => Message.ToggledQueue({ isOpen }))],
    [
      h.summary([], [`Processing Queue · ${channel.processing.total}`]),
      h.div(
        [h.Class("disclosure-body")],
        [
          h.p(
            [h.Class("muted")],
            [
              "Arrival order, oldest first. Entries remain here until fulfilled or cancelled; the first entry is not necessarily actively processing.",
            ],
          ),
          channel.processing.total > channel.processing.items.length
            ? h.p(
                [h.Class("warning-text")],
                [
                  `Showing the oldest ${channel.processing.items.length} of ${channel.processing.total} Redemptions. Newer entries appear as these leave the queue.`,
                ],
              )
            : h.empty,
          Array.match(channel.processing.items, {
            onEmpty: () => h.p([], ["No Redemptions waiting."]),
            onNonEmpty: (items) =>
              h.ol(
                [h.Class("redemptions")],
                Array.map(items, (redemption) =>
                  h.keyed("li")(redemption.id, [], [redemptionView(redemption, model.now, h)]),
                ),
              ),
          }),
        ],
      ),
    ],
  )

const heldDetailsView = (channel: ChannelMonitoring, model: Model, h: HtmlBuilder<Message>) =>
  h.details(
    [h.Open(model.isHeldOpen), h.OnToggle((isOpen) => Message.ToggledHeld({ isOpen }))],
    [
      h.summary([], [`Held Redemptions · ${channel.held.total}`]),
      h.div(
        [h.Class("disclosure-body")],
        [
          h.p(
            [h.Class("muted")],
            [
              "These Redemptions could not be cancelled while the Twitch Connection was unavailable. The next reconcile attempts cancellation again. Reconnect Twitch if reauthorization is required.",
            ],
          ),
          channel.held.total > channel.held.items.length
            ? h.p(
                [h.Class("warning-text")],
                [
                  `Showing the oldest ${channel.held.items.length} of ${channel.held.total} Held Redemptions. Newer entries appear as these are settled.`,
                ],
              )
            : h.empty,
          Array.match(channel.held.items, {
            onEmpty: () => h.p([], ["No Held Redemptions."]),
            onNonEmpty: (items) =>
              h.ul(
                [h.Class("redemptions")],
                Array.map(items, (held) =>
                  h.keyed("li")(
                    held.redemption.id,
                    [],
                    [
                      redemptionView(held.redemption, model.now, h),
                      h.p(
                        [h.Class("warning-text")],
                        [
                          "Twitch unavailable when cancellation was attempted. Refund not yet confirmed.",
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          }),
        ],
      ),
    ],
  )

export const channelDetailsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("processing-details"), h.AriaLabel("Redemption details")],
    [
      h.h2([], ["Redemption details"]),
      Option.match(AsyncData.getData(model.channel), {
        onNone: () =>
          h.p([h.Class("muted")], ["Details will appear when Channel monitoring is available."]),
        onSome: (channel) =>
          h.div(
            [],
            [
              isOutdated(model.channel, model.maybeChannelCheckedAt, model.now)
                ? h.p(
                    [h.Class("warning-text")],
                    ["Showing the last successful snapshot. Counts and entries may have changed."],
                  )
                : h.empty,
              processingDetailsView(channel, model, h),
              heldDetailsView(channel, model, h),
            ],
          ),
      }),
    ],
  )
