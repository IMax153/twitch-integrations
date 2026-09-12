import type { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { providerLabels } from "@twitch-integrations/domain/ProviderName"
import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { HtmlBuilder } from "foldkit/html"
import { Message } from "./message.ts"
import type { Model } from "./model.ts"
import { dateView, freshnessView } from "./monitoringView.ts"

const connectionDetailsView = (
  connection: ConnectionSummary,
  model: Model,
  h: HtmlBuilder<Message>,
) =>
  // NOTE: native details/summary supplies disclosure keyboard behavior. Its open state belongs to the Model.
  h.details(
    [
      h.Open(model.expandedProviders.includes(connection.provider)),
      h.OnToggle((isOpen) => Message.ToggledConnection({ provider: connection.provider, isOpen })),
    ],
    [
      h.summary([], [`${providerLabels[connection.provider]} details`]),
      h.div(
        [h.Class("disclosure-body")],
        [
          Option.match(connection.connectedAccount, {
            onNone: () => h.empty,
            onSome: ({ id }) => h.p([h.Class("muted")], [`Account ID: ${id}`]),
          }),
          h.dl(
            [],
            [
              dateView("Token expires", connection.expiresAt, h),
              dateView("Next refresh", connection.nextRefreshAt, h),
            ],
          ),
          Array.match(connection.scopes, {
            onEmpty: () => h.p([h.Class("muted")], ["No permissions granted yet."]),
            onNonEmpty: (scopes) =>
              h.div(
                [],
                [
                  h.p([h.Class("detail-label")], ["Granted permissions"]),
                  h.ul(
                    [h.Class("scopes")],
                    Array.map(scopes, (scope) => h.keyed("li")(scope, [], [h.code([], [scope])])),
                  ),
                ],
              ),
          }),
        ],
      ),
    ],
  )

const connectionView = (connection: ConnectionSummary, model: Model, h: HtmlBuilder<Message>) =>
  h.keyed("article")(
    connection.provider,
    [h.DataAttribute("provider", connection.provider), h.Class("connection")],
    [
      h.div(
        [h.Class("connection-heading")],
        [
          h.h3([], [providerLabels[connection.provider]]),
          h.p(
            [h.Class("status"), h.DataAttribute("state", connection.status)],
            [connection.status],
          ),
        ],
      ),
      Option.match(connection.connectedAccount, {
        onNone: () => h.p([h.Class("muted")], ["No Connected Account"]),
        onSome: ({ displayName }) => h.p([h.Class("connected-account")], [displayName]),
      }),
      Option.match(connection.lastRefreshError, {
        onNone: () => h.empty,
        onSome: ({ message, at }) =>
          h.p(
            [h.Class("last-refresh-error warning-text")],
            [`Last refresh error at ${DateTime.formatIso(at)}: ${message}`],
          ),
      }),
      // NOTE: native form submission must navigate through the Worker's OAuth redirect, without client interception.
      h.form(
        [h.Method("post"), h.Action(`/oauth/${connection.provider}/authorize`)],
        [
          h.button(
            [
              h.Type("submit"),
              h.AriaLabel(
                `${connection.status === "Not Configured" ? "Connect" : "Reconnect"} ${providerLabels[connection.provider]}`,
              ),
            ],
            [connection.status === "Not Configured" ? "Connect" : "Reconnect"],
          ),
        ],
      ),
      connectionDetailsView(connection, model, h),
    ],
  )

export const connectionsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("connections-panel"), h.AriaLabel("Connections")],
    [
      h.h2([], ["Connections"]),
      Option.match(AsyncData.getData(model.connections), {
        onNone: () =>
          h.p(
            [h.Class("loading")],
            [
              AsyncData.isPending(model.connections)
                ? "Loading the Connections."
                : "Connection status unavailable",
            ],
          ),
        onSome: (connections) =>
          h.div(
            [h.Class("connections")],
            Array.match(connections, {
              onEmpty: () => [
                h.p(
                  [h.Class("warning-text")],
                  ["No Connections were returned. Refresh to check again."],
                ),
              ],
              onNonEmpty: (connections) =>
                Array.map(connections, (connection) => connectionView(connection, model, h)),
            }),
          ),
      }),
      freshnessView(model.connections, model.maybeConnectionsCheckedAt, model.now, h),
    ],
  )
