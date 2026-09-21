import type { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Document, HtmlBuilder } from "foldkit/html"
import { channelDetailsView, processingView, songRequestsView } from "./channelView.ts"
import { chatCommandsView } from "./chatCommandView.ts"
import { connectionsView } from "./connectionView.ts"
import { Message } from "./message.ts"
import type { Model } from "./model.ts"
import { overlayView } from "./overlayView.ts"

const resultMessages: Record<
  BroadcasterResult,
  { readonly kind: "success" | "error"; readonly text: string }
> = {
  connected: { kind: "success", text: "Connection authorized." },
  denied: { kind: "error", text: "Authorization was denied at the Provider." },
  "missing-code": { kind: "error", text: "The Provider returned no authorization code." },
  "attempt-expired": { kind: "error", text: "The Authorization Attempt expired. Try again." },
  "identity-mismatch": {
    kind: "error",
    text: "The callback came from a different Access identity than the one that started it.",
  },
  "attempt-mismatch": {
    kind: "error",
    text: "The callback did not match a pending Authorization Attempt.",
  },
  "exchange-failed": { kind: "error", text: "Exchanging the authorization code failed." },
}

const resultView = (model: Model, h: HtmlBuilder<Message>) =>
  Option.match(model.maybeResult, {
    onNone: () => h.empty,
    onSome: (result) =>
      h.p(
        [
          h.Class(resultMessages[result].kind === "success" ? "result success" : "result error"),
          h.Role("status"),
        ],
        [resultMessages[result].text],
      ),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Broadcaster Page · Twitch Integrations",
  body: h.main(
    [],
    [
      h.header(
        [h.Class("page-header")],
        [
          h.div(
            [],
            [
              h.h1([], ["Broadcaster Page"]),
              h.p(
                [h.Class("muted")],
                ["Song Requests, Chat Commands, the Overlay, and Connections."],
              ),
            ],
          ),
          // NOTE: this standalone native button is a single refresh action, with no composite-widget behavior.
          h.button(
            [
              h.Type("button"),
              h.OnClick(Message.ClickedReload()),
              h.Disabled(
                AsyncData.isPending(model.connections) && AsyncData.isPending(model.channel),
              ),
            ],
            ["Refresh"],
          ),
        ],
      ),
      resultView(model, h),
      h.div(
        [h.Class("overview")],
        [songRequestsView(model, h), processingView(model, h), connectionsView(model, h)],
      ),
      chatCommandsView(model, h),
      overlayView(model, h),
      channelDetailsView(model, h),
      h.footer(
        [h.Class("page-footer")],
        [
          h.p(
            [],
            [
              model.isVisible
                ? "Checks every 10 seconds · Marked stale after 30 seconds without a successful check."
                : "Automatic checks paused while this page is hidden.",
            ],
          ),
          h.p([], ["Channel status reflects stored observations, not a live Provider probe."]),
        ],
      ),
    ],
  ),
})
