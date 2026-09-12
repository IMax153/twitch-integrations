import type { ConnectedAccount } from "@twitch-integrations/domain/ConnectedAccount"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import { providerLabels } from "@twitch-integrations/domain/ProviderName"
import type { RefreshError } from "@twitch-integrations/domain/RefreshError"
import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { AsyncData, Command, Http, type Runtime, type Update } from "foldkit"
import type { Document, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"
import { evo } from "foldkit/struct"

// FLAGS

export const Flags = Schema.Struct({
  maybeResult: Schema.Option(BroadcasterResult),
}).annotate({ identifier: "Flags" })
export type Flags = typeof Flags.Type

// MODEL

const Connections = Schema.Array(ConnectionSummary).annotate({ identifier: "Connections" })

const ConnectionsAsyncData = AsyncData.Schema(Connections, Schema.String)

export const Model = Schema.Struct({
  connections: ConnectionsAsyncData.schema,
  maybeResult: Schema.Option(BroadcasterResult),
}).annotate({ identifier: "Model" })
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  SucceededFetchConnections: { connections: Connections },
  FailedFetchConnections: { error: Schema.String },
  ClickedReload: {},
})
export type Message = typeof Message.Type

// COMMAND

export const FetchConnections = Command.define("FetchConnections", {
  messages: [Message.SucceededFetchConnections, Message.FailedFetchConnections],
  execute: Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
    const response = yield* client.get("/setup/api/connections")
    const connections = yield* Schema.decodeUnknownEffect(Connections)(yield* response.json)
    return Message.SucceededFetchConnections({ connections })
  }).pipe(
    Effect.orElseSucceed(() =>
      Message.FailedFetchConnections({ error: "The Connections could not be loaded." }),
    ),
    // The page's command is its entry point.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide
    Effect.provide(Http.layer),
  ),
})

// INIT

export const init: Runtime.ApplicationInit<Model, Message, Flags> = (flags) => ({
  model: { connections: AsyncData.Loading(), maybeResult: flags.maybeResult },
  commands: [FetchConnections()],
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    SucceededFetchConnections: ({ connections }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.succeed(connections)),
      }),
    }),
    FailedFetchConnections: ({ error }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.fail(error)),
      }),
    }),
    ClickedReload: () =>
      Option.match(AsyncData.revalidateOrLoad(model.connections), {
        onNone: () => ({ model }),
        onSome: (connections) => ({
          model: evo(model, { connections: () => connections }),
          commands: [FetchConnections()],
        }),
      }),
  })

// VIEW

interface ResultMessage {
  readonly kind: "success" | "error"
  readonly text: string
}

const resultClasses: Record<ResultMessage["kind"], string> = {
  success: "result success",
  error: "result error",
}

const resultMessages: Record<BroadcasterResult, ResultMessage> = {
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

const resultView = (maybeResult: Option.Option<BroadcasterResult>, h: HtmlBuilder<Message>) =>
  Option.match(maybeResult, {
    onNone: () => h.empty,
    onSome: (result) => {
      const message = resultMessages[result]
      return h.p([h.Class(resultClasses[message.kind]), h.Role("status")], [message.text])
    },
  })

const connectedAccountView = (
  connectedAccount: Option.Option<ConnectedAccount>,
  h: HtmlBuilder<Message>,
) =>
  Option.match(connectedAccount, {
    onNone: () => h.empty,
    onSome: ({ displayName, id }) =>
      h.p([h.Class("connected-account")], [`${displayName} (${id})`]),
  })

const scopesView = (scopes: ReadonlyArray<string>, h: HtmlBuilder<Message>) =>
  Array.isReadonlyArrayNonEmpty(scopes)
    ? h.ul(
        [h.Class("scopes")],
        Array.map(scopes, (scope) => h.li([], [scope])),
      )
    : h.empty

const expiresAtView = (expiresAt: Option.Option<DateTime.Utc>, h: HtmlBuilder<Message>) =>
  Option.match(expiresAt, {
    onNone: () => h.empty,
    onSome: (expiresAt) => h.p([h.Class("expires-at")], [DateTime.formatIso(expiresAt)]),
  })

const nextRefreshAtView = (nextRefreshAt: Option.Option<DateTime.Utc>, h: HtmlBuilder<Message>) =>
  Option.match(nextRefreshAt, {
    onNone: () => h.empty,
    onSome: (nextRefreshAt) =>
      h.p([h.Class("next-refresh-at")], [`Next refresh at ${DateTime.formatIso(nextRefreshAt)}`]),
  })

const lastRefreshErrorView = (
  lastRefreshError: Option.Option<RefreshError>,
  h: HtmlBuilder<Message>,
) =>
  Option.match(lastRefreshError, {
    onNone: () => h.empty,
    onSome: ({ message, at }) =>
      h.p(
        [h.Class("last-refresh-error")],
        [`Last refresh error at ${DateTime.formatIso(at)}: ${message}`],
      ),
  })

const connectionView = (
  {
    provider,
    status,
    connectedAccount,
    scopes,
    expiresAt,
    nextRefreshAt,
    lastRefreshError,
  }: ConnectionSummary,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("section")(
    provider,
    [h.DataAttribute("provider", provider)],
    [
      h.h2([], [providerLabels[provider]]),
      h.p([h.Class("status")], [status]),
      connectedAccountView(connectedAccount, h),
      scopesView(scopes, h),
      expiresAtView(expiresAt, h),
      nextRefreshAtView(nextRefreshAt, h),
      lastRefreshErrorView(lastRefreshError, h),
      // NOTE: a native form submit, so the browser navigates to the Worker's
      // authorize route and follows its redirect to the Provider. A plain
      // button keeps the form free of client-side handling on purpose.
      h.form(
        [h.Method("post"), h.Action(`/oauth/${provider}/authorize`)],
        [h.button([h.Type("submit")], [status === "Not Configured" ? "Connect" : "Reconnect"])],
      ),
    ],
  )

const connectionsView = (connections: ReadonlyArray<ConnectionSummary>, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("connections")],
    Array.map(connections, (connection) => connectionView(connection, h)),
  )

// NOTE: a plain button is enough for a single retry action; the page has no
// other interactive widgets that would justify pulling in @foldkit/ui.
const failureView = (error: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("failure")],
    [h.p([h.Role("alert")], [error]), h.button([h.OnClick(Message.ClickedReload())], ["Reload"])],
  )

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Twitch Integrations",
  body: h.main(
    [],
    [
      h.h1([], ["Connections"]),
      resultView(model.maybeResult, h),
      AsyncData.match(model.connections, {
        onIdle: () => h.empty,
        onLoading: () => h.p([h.Class("loading")], ["Loading the Connections."]),
        onRefreshing: (connections) => connectionsView(connections, h),
        onFailure: (error) => failureView(error, h),
        onStale: ({ data }) => connectionsView(data, h),
        onSuccess: (connections) => connectionsView(connections, h),
      }),
    ],
  ),
})
