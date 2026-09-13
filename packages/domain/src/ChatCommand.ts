import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * The scopes the Twitch Connection must grant before the deployment can read
 * chat through the webhook receiver. Twitch requires `user:read:chat` from the
 * chatting user and, for an app access token, `user:bot` from that user and
 * `channel:bot` from the broadcaster. The reconcile skips the chat Event Subscription and the Broadcaster Page shows
 * a notice while any of these is missing. See
 * `docs/research/twitch-chat-message-eventsub.md`.
 */
export const requiredChatScopes: ReadonlyArray<string> = [
  "user:read:chat",
  "user:bot",
  "channel:bot",
]

/** The required chat scopes a Twitch Connection's granted scopes lack, in the order Twitch lists them. */
export const missingChatScopes = (granted: ReadonlyArray<string>): ReadonlyArray<string> =>
  requiredChatScopes.filter((scope) => !granted.includes(scope))

/**
 * What a viewer types after the `!`: letters, digits, and underscores, one to
 * thirty-two of them, stored exactly as the Broadcaster typed it.
 */
export const ChatCommandName = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_]{1,32}$/))
  .pipe(Schema.brand("ChatCommandName"))
  .annotate({ identifier: "ChatCommandName" })
export type ChatCommandName = typeof ChatCommandName.Type

/**
 * The fixed text a Chat Command answers with, bounded by the 500 characters
 * Twitch allows in one chat message.
 */
export const ChatCommandResponse = Schema.String.check(Schema.isLengthBetween(1, 500))
  .pipe(Schema.brand("ChatCommandResponse"))
  .annotate({ identifier: "ChatCommandResponse" })
export type ChatCommandResponse = typeof ChatCommandResponse.Type

/** A Disabled Chat Command stays defined but is never answered. */
export const ChatCommandStatus = Schema.Literals(["Enabled", "Disabled"]).annotate({
  identifier: "ChatCommandStatus",
})
export type ChatCommandStatus = typeof ChatCommandStatus.Type

/** The longest Cooldown the Broadcaster may set. */
export const maximumCooldown = Duration.hours(1)

/** The Cooldown a new Chat Command starts with. */
export const defaultCooldown = Duration.seconds(10)
const defaultCooldownMillis = Duration.toMillis(defaultCooldown)

/**
 * A Cooldown as a Duration, carried over the wire as whole milliseconds and
 * bounded from zero to one hour.
 */
export const Cooldown = Schema.DurationFromMillis.check(
  Schema.makeFilter<Duration.Duration>(
    (cooldown) => Duration.between(cooldown, { minimum: Duration.zero, maximum: maximumCooldown }),
    { title: "Cooldown", description: "a Duration from zero to one hour" },
  ),
).annotate({ identifier: "Cooldown" })
export type Cooldown = typeof Cooldown.Type

/**
 * A named reply the Broadcaster defines for the Channel's chat. The encoded
 * form is plain JSON: the Cooldown as milliseconds, times as ISO 8601, and
 * absent values as null. `cooldownUntil` is when the running Cooldown ends,
 * cleared by any edit; `lastAnsweredAt` survives edits so the page can keep
 * showing when the Chat Command last answered.
 */
export const ChatCommand = Schema.Struct({
  name: ChatCommandName,
  response: ChatCommandResponse,
  status: ChatCommandStatus,
  cooldown: Cooldown,
  cooldownUntil: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
  lastAnsweredAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
}).annotate({ identifier: "ChatCommand" })
export type ChatCommand = typeof ChatCommand.Type
export type ChatCommandEncoded = typeof ChatCommand.Encoded

/**
 * What the Broadcaster Page sends to edit a Chat Command: everything but the
 * name, which is fixed at creation and travels in the route. Every field is
 * required so that an edit never re-enables or re-times a Chat Command the
 * Broadcaster did not touch.
 */
export const ChatCommandDraft = Schema.Struct({
  response: ChatCommandResponse,
  cooldown: Cooldown,
  status: ChatCommandStatus,
}).annotate({ identifier: "ChatCommandDraft" })
export type ChatCommandDraft = typeof ChatCommandDraft.Type
export type ChatCommandDraftEncoded = typeof ChatCommandDraft.Encoded

/**
 * What the Broadcaster Page sends to create a Chat Command: the name and the
 * draft, where the common case needs only a name and a response. A missing
 * status means Enabled and a missing Cooldown means ten seconds.
 */
export const NewChatCommand = Schema.Struct({
  name: ChatCommandName,
  response: ChatCommandResponse,
  cooldown: Cooldown.pipe(Schema.withDecodingDefault(Effect.succeed(defaultCooldownMillis))),
  status: ChatCommandStatus.pipe(Schema.withDecodingDefault(Effect.succeed("Enabled" as const))),
}).annotate({ identifier: "NewChatCommand" })
export type NewChatCommand = typeof NewChatCommand.Type
export type NewChatCommandEncoded = typeof NewChatCommand.Encoded

/**
 * Finds the Chat Command a chat message invokes: the one whose `!name` equals
 * the message text once trimmed of surrounding whitespace, compared
 * case-sensitively. Disabled Chat Commands and Cooldowns are the caller's
 * concern; this only says which Chat Command was named, if any.
 */
export const matchChatCommand = (
  text: string,
  commands: ReadonlyArray<ChatCommand>,
): Option.Option<ChatCommand> => {
  const trimmed = text.trim()
  if (!trimmed.startsWith("!")) {
    return Option.none()
  }
  const name = trimmed.slice(1)
  return Option.fromNullishOr(commands.find((command) => command.name === name))
}
