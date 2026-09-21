import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Html, HtmlBuilder } from "foldkit/html"
import { Message } from "./message.ts"
import type { IssuedOverlayUrl, Model } from "./model.ts"
import { elapsed } from "./monitoringView.ts"

/** The size the widget is drawn at, which the Broadcaster gives the browser source. */
const widgetSize = "520 × 150"

const issuedUrlView = (issued: IssuedOverlayUrl, model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("overlay-issued"), h.Role("status")],
    [
      h.p(
        [h.Class("warning-text overlay-once")],
        [
          "This URL is shown once. Paste it into OBS now; anyone who has it can watch your queue until you rotate it.",
        ],
      ),
      h.label([h.For("overlay-url")], ["Browser source URL"]),
      h.input([
        h.Id("overlay-url"),
        h.Type("text"),
        h.Value(issued.url),
        h.Readonly(true),
        h.Spellcheck(false),
      ]),
      h.div(
        [h.Class("overlay-actions")],
        [
          h.button(
            [h.Type("button"), h.OnClick(Message.ClickedCopyOverlayUrl())],
            [
              Option.match(issued.maybeCopied, {
                onNone: () => "Copy URL",
                onSome: (isCopied) => (isCopied ? "Copied" : "Copy failed, select it instead"),
              }),
            ],
          ),
          h.button(
            [h.Type("button"), h.OnClick(Message.ClickedDismissOverlayUrl())],
            ["Done, hide it"],
          ),
        ],
      ),
      h.p(
        [h.Class("muted")],
        [
          `In OBS add a Browser source with this URL at ${widgetSize}, and tick "Shutdown source when not visible" and "Refresh browser when scene becomes active".`,
        ],
      ),
      h.p([h.Class("muted")], [`Refreshed ${refreshWording(model)}`]),
    ],
  )

const refreshWording = (model: Model): string =>
  Option.match(model.maybeChannelCheckedAt, {
    onNone: () => "when the Channel is next checked.",
    onSome: (checkedAt) => `${elapsed(checkedAt, model.now)} ago.`,
  })

const rotationView = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("overlay-rotate")],
    [
      h.p([], ["Rotate the Overlay URL?"]),
      h.p(
        [h.Class("muted")],
        ["The browser source OBS holds stops working until you paste the new URL into it."],
      ),
      h.div(
        [h.Class("overlay-actions")],
        [
          h.button(
            [
              h.Type("button"),
              h.OnClick(Message.ClickedConfirmOverlayRotation()),
              h.Disabled(model.isOverlayKeyPending),
            ],
            ["Rotate"],
          ),
          h.button(
            [
              h.Type("button"),
              h.OnClick(Message.ClickedKeepOverlayKey()),
              h.Disabled(model.isOverlayKeyPending),
            ],
            ["Keep the current URL"],
          ),
        ],
      ),
    ],
  )

/** What the section shows about the key on the Channel, and the one action that fits. */
const keyStateView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(AsyncData.getData(model.channel), {
    onNone: () =>
      h.p(
        [h.Class("muted")],
        [
          AsyncData.isPending(model.channel)
            ? "Loading the Overlay…"
            : "The Overlay will appear when Channel monitoring is available.",
        ],
      ),
    onSome: (channel) =>
      Option.match(channel.overlayKey, {
        onNone: () =>
          h.div(
            [],
            [
              h.p([h.Class("headline-state")], ["No Overlay URL yet"]),
              h.button(
                [
                  h.Type("button"),
                  h.OnClick(Message.ClickedIssueOverlayKey()),
                  h.Disabled(model.isOverlayKeyPending),
                ],
                ["Create Overlay URL"],
              ),
            ],
          ),
        onSome: ({ issuedAt }) =>
          h.div(
            [],
            [
              h.p(
                [h.Class("headline-state"), h.DataAttribute("tone", "success")],
                ["Overlay URL issued"],
              ),
              h.p(
                [h.Class("muted overlay-issued-at")],
                [
                  `Issued ${elapsed(DateTime.toEpochMillis(issuedAt), model.now)} ago. The URL is not stored, so if you lose it, rotate it.`,
                ],
              ),
              model.isOverlayRotationPending
                ? rotationView(model, h)
                : h.button(
                    [
                      h.Type("button"),
                      h.OnClick(Message.ClickedRotateOverlayKey()),
                      h.Disabled(model.isOverlayKeyPending),
                    ],
                    ["Rotate Overlay URL"],
                  ),
            ],
          ),
      }),
  })

export const overlayView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("overlay-panel"), h.AriaLabel("Overlay")],
    [
      h.h2([], ["Overlay"]),
      h.p(
        [h.Class("muted")],
        [
          "A browser source for OBS showing the Spotify track playing and the next four in the queue. Its URL carries a secret key in place of an Access login.",
        ],
      ),
      keyStateView(model, h),
      Option.match(model.maybeOverlayError, {
        onNone: () => h.empty,
        onSome: (message) => h.p([h.Class("error-text"), h.Role("alert")], [message]),
      }),
      Option.match(model.maybeIssuedOverlayUrl, {
        onNone: () => h.empty,
        onSome: (issued) => issuedUrlView(issued, model, h),
      }),
    ],
  )
