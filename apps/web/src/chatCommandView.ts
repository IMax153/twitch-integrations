import type { ChatCommand } from "@twitch-integrations/domain/ChatCommand"
import { maximumCooldown, missingChatScopes } from "@twitch-integrations/domain/ChatCommand"
import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Equal from "effect/Equal"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { Html, HtmlBuilder } from "foldkit/html"
import { Message } from "./message.ts"
import type { ChatCommandEdit, Model } from "./model.ts"
import { elapsed } from "./monitoringView.ts"

const invocation = (name: string) => `!${name}`

/**
 * The notice the section shows while the Twitch Connection is Authorized but
 * was granted before the chat scopes were asked for: the Chat Commands are
 * defined but silent until the Broadcaster authorizes Twitch again.
 */
const scopeNoticeView = (model: Model, h: HtmlBuilder<Message>) =>
  Option.match(
    Option.flatMap(AsyncData.getData(model.connections), (connections) =>
      Array.findFirst(
        connections,
        (connection) => connection.provider === "twitch" && connection.status === "Authorized",
      ),
    ),
    {
      onNone: () => h.empty,
      onSome: (twitch) =>
        Array.match(missingChatScopes(twitch.scopes), {
          onEmpty: () => h.empty,
          onNonEmpty: (missing) =>
            h.p(
              [h.Class("scope-notice warning-text"), h.Role("status")],
              [
                "Chat Commands are silent until the Twitch Connection grants ",
                ...Array.flatMap(missing, (scope, index) => [
                  index === 0 ? "" : index === missing.length - 1 ? " and " : ", ",
                  h.code([], [scope]),
                ]),
                ". Press Reconnect on the Twitch Connection to grant them.",
              ],
            ),
        }),
    },
  )

/** The refusal to show by this row or form, if the last write's refusal was its own. */
const rejectionView = (
  model: Model,
  maybeName: Option.Option<string>,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(
    Option.filter(model.maybeChatCommandError, (error) => Equal.equals(error.maybeName, maybeName)),
    {
      onNone: () => h.empty,
      onSome: ({ message }) => h.p([h.Class("error-text"), h.Role("alert")], [message]),
    },
  )

const editRowView = (
  command: ChatCommand,
  edit: ChatCommandEdit,
  model: Model,
  h: HtmlBuilder<Message>,
) =>
  h.form(
    [h.Class("chat-command-edit"), h.OnSubmit(Message.SubmittedChatCommandEdit())],
    [
      h.p([h.Class("chat-command-heading")], [h.strong([], [invocation(command.name)])]),
      h.label([h.For(`chat-command-${command.name}-response`)], ["Response"]),
      h.textarea([
        h.Id(`chat-command-${command.name}-response`),
        h.Value(edit.response),
        h.OnInput((value) => Message.UpdatedChatCommandResponse({ value })),
        h.Maxlength(500),
        h.Rows(3),
        h.Required(true),
      ]),
      h.label([h.For(`chat-command-${command.name}-cooldown`)], ["Cooldown in seconds"]),
      h.input([
        h.Id(`chat-command-${command.name}-cooldown`),
        h.Type("number"),
        h.InputMode("numeric"),
        h.Min("0"),
        h.Max(String(Duration.toSeconds(maximumCooldown))),
        h.Step("1"),
        h.Value(edit.cooldownSeconds),
        h.OnInput((value) => Message.UpdatedChatCommandCooldown({ value })),
        h.Required(true),
      ]),
      rejectionView(model, Option.some(command.name), h),
      h.div(
        [h.Class("chat-command-actions")],
        [
          h.button(
            [
              h.Type("submit"),
              h.AriaLabel(`Save ${invocation(command.name)}`),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Save"],
          ),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Cancel editing ${invocation(command.name)}`),
              h.OnClick(Message.ClickedCancelChatCommandEdit()),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Cancel"],
          ),
        ],
      ),
    ],
  )

const deleteRowView = (command: ChatCommand, model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("chat-command-delete")],
    [
      h.p([], [`Delete ${invocation(command.name)}?`]),
      h.p([h.Class("muted")], ["Viewers will no longer get an answer. This cannot be undone."]),
      rejectionView(model, Option.some(command.name), h),
      h.div(
        [h.Class("chat-command-actions")],
        [
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Confirm deleting ${invocation(command.name)}`),
              h.OnClick(Message.ClickedConfirmChatCommandDeletion()),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Delete"],
          ),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Keep ${invocation(command.name)}`),
              h.OnClick(Message.ClickedKeepChatCommand()),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Keep"],
          ),
        ],
      ),
    ],
  )

const displayRowView = (command: ChatCommand, model: Model, h: HtmlBuilder<Message>) => {
  const nextStatus = command.status === "Enabled" ? "Disabled" : "Enabled"
  return h.div(
    [],
    [
      h.div(
        [h.Class("chat-command-heading")],
        [
          h.strong([], [invocation(command.name)]),
          h.span([h.Class("status"), h.DataAttribute("state", command.status)], [command.status]),
          h.span([h.Class("muted")], [`Cooldown ${Duration.toSeconds(command.cooldown)}s`]),
        ],
      ),
      h.p([h.Class("chat-command-response")], [command.response]),
      h.p(
        [h.Class("muted chat-command-answered")],
        [
          Option.match(command.lastAnsweredAt, {
            onNone: () => "Not answered yet",
            onSome: (at) => `Last answered ${elapsed(DateTime.toEpochMillis(at), model.now)} ago`,
          }),
        ],
      ),
      rejectionView(model, Option.some(command.name), h),
      h.div(
        [h.Class("chat-command-actions")],
        [
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Edit ${invocation(command.name)}`),
              h.OnClick(Message.ClickedEditChatCommand({ name: command.name })),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Edit"],
          ),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(
                `${nextStatus === "Disabled" ? "Disable" : "Enable"} ${invocation(command.name)}`,
              ),
              h.OnClick(
                Message.ClickedChatCommandStatus({ name: command.name, status: nextStatus }),
              ),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            [nextStatus === "Disabled" ? "Disable" : "Enable"],
          ),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Delete ${invocation(command.name)}`),
              h.OnClick(Message.ClickedDeleteChatCommand({ name: command.name })),
              h.Disabled(Option.isSome(model.maybePendingWrite)),
            ],
            ["Delete"],
          ),
        ],
      ),
    ],
  )
}

const rowView = (command: ChatCommand, model: Model, h: HtmlBuilder<Message>) =>
  h.keyed("li")(
    command.name,
    [h.Class("chat-command"), h.DataAttribute("status", command.status)],
    [
      Option.match(
        Option.filter(model.maybeChatCommandEdit, (edit) => edit.name === command.name),
        {
          onSome: (edit) => editRowView(command, edit, model, h),
          onNone: () =>
            Option.contains(model.maybePendingDeletion, command.name)
              ? deleteRowView(command, model, h)
              : displayRowView(command, model, h),
        },
      ),
    ],
  )

const listView = (commands: ReadonlyArray<ChatCommand>, model: Model, h: HtmlBuilder<Message>) =>
  Array.match(commands, {
    onEmpty: () => h.p([h.Class("muted")], ["No Chat Commands yet."]),
    onNonEmpty: (commands) =>
      h.ul(
        [h.Class("chat-command-list")],
        Array.map(commands, (command) => rowView(command, model, h)),
      ),
  })

const addFormView = (model: Model, h: HtmlBuilder<Message>) =>
  h.form(
    [h.Class("chat-command-add"), h.OnSubmit(Message.SubmittedNewChatCommand())],
    [
      h.h3([], ["Add a Chat Command"]),
      h.label([h.For("new-chat-command-name")], ["Name, typed after the !"]),
      h.input([
        h.Id("new-chat-command-name"),
        h.Type("text"),
        h.Value(model.newChatCommand.name),
        h.OnInput((value) => Message.UpdatedNewChatCommandName({ value })),
        h.Maxlength(32),
        h.Pattern("[A-Za-z0-9_]{1,32}"),
        h.Autocomplete("off"),
        h.Spellcheck(false),
        h.Required(true),
      ]),
      h.label([h.For("new-chat-command-response")], ["Response"]),
      h.textarea([
        h.Id("new-chat-command-response"),
        h.Value(model.newChatCommand.response),
        h.OnInput((value) => Message.UpdatedNewChatCommandResponse({ value })),
        h.Maxlength(500),
        h.Rows(3),
        h.Required(true),
      ]),
      h.p(
        [h.Class("muted")],
        [
          "Letters, digits, and underscores, up to 32 characters. A new Chat Command starts Enabled with a ten second Cooldown.",
        ],
      ),
      rejectionView(model, Option.none(), h),
      h.button(
        [h.Type("submit"), h.Disabled(Option.isSome(model.maybePendingWrite))],
        ["Add Chat Command"],
      ),
    ],
  )

export const chatCommandsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class("chat-commands"), h.AriaLabel("Chat Commands")],
    [
      h.h2([], ["Chat Commands"]),
      h.p(
        [h.Class("muted")],
        [
          "A viewer who types exactly the name after a ! gets the response as a reply, at most once per Cooldown.",
        ],
      ),
      scopeNoticeView(model, h),
      Option.match(AsyncData.getData(model.channel), {
        onNone: () =>
          h.p(
            [h.Class("muted")],
            [
              AsyncData.isPending(model.channel)
                ? "Loading Chat Commands…"
                : "Chat Commands will appear when Channel monitoring is available.",
            ],
          ),
        onSome: (channel) => listView(channel.chatCommands, model, h),
      }),
      addFormView(model, h),
    ],
  )
