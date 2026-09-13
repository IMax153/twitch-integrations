import * as Schema from "effect/Schema"

/** A Chat Command with this name, compared without regard to case, already exists. */
export class DuplicateChatCommand extends Schema.TaggedError<DuplicateChatCommand>()(
  "DuplicateChatCommand",
  { name: Schema.String },
) {}

/** No Chat Command has this name, so there is nothing to edit or delete. */
export class UnknownChatCommand extends Schema.TaggedError<UnknownChatCommand>()(
  "UnknownChatCommand",
  { name: Schema.String },
) {}

/** The create or edit body did not decode; `message` is the Schema issue, worded for the page. */
export class InvalidChatCommandDraft extends Schema.TaggedError<InvalidChatCommandDraft>()(
  "InvalidChatCommandDraft",
  { message: Schema.String },
) {}

/** Why a Chat Command write was refused. */
export type ChatCommandRejection =
  | DuplicateChatCommand
  | UnknownChatCommand
  | InvalidChatCommandDraft
