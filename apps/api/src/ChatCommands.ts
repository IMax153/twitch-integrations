import {
  type ChatCommand,
  type ChatCommandDraft,
  type NewChatCommand,
} from "@twitch-integrations/domain/ChatCommand"
import {
  DuplicateChatCommand,
  UnknownChatCommand,
} from "@twitch-integrations/domain/ChatCommandErrors"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { ChannelLock } from "./ChannelLock.ts"
import { ChannelStore } from "./ChannelStore.ts"

export interface ChatCommandsService {
  /** Defines a Chat Command; one whose name is already taken, in any casing, is refused. */
  readonly create: (draft: NewChatCommand) => Effect.Effect<ChatCommand, DuplicateChatCommand>
  /**
   * Replaces everything but the name and what the Chat Command remembers of
   * its last answer. Any edit, including enabling, ends a running Cooldown.
   */
  readonly update: (
    name: string,
    draft: ChatCommandDraft,
  ) => Effect.Effect<ChatCommand, UnknownChatCommand>
  readonly remove: (name: string) => Effect.Effect<void, UnknownChatCommand>
}

const make = Effect.gen(function* () {
  const store = yield* ChannelStore
  const lock = yield* ChannelLock

  const create: ChatCommandsService["create"] = Effect.fn("ChatCommands.create")(
    function* (draft) {
      const existing = yield* store.readChatCommand(draft.name)
      if (Option.isSome(existing)) {
        return yield* DuplicateChatCommand.make({ name: draft.name })
      }
      const command: ChatCommand = {
        ...draft,
        cooldownUntil: Option.none(),
        lastAnsweredAt: Option.none(),
      }
      yield* store.writeChatCommand(command)
      yield* Effect.logInfo(`Created the ${command.name} Chat Command`)
      return command
    },
    (self) => lock.withPermit(self),
  )

  const update: ChatCommandsService["update"] = Effect.fn("ChatCommands.update")(
    function* (name, draft) {
      const existing = yield* store.readChatCommand(name)
      if (Option.isNone(existing)) {
        return yield* UnknownChatCommand.make({ name })
      }
      const command: ChatCommand = {
        ...existing.value,
        ...draft,
        cooldownUntil: Option.none(),
      }
      yield* store.writeChatCommand(command)
      yield* Effect.logInfo(`Edited the ${command.name} Chat Command`)
      return command
    },
    (self) => lock.withPermit(self),
  )

  const remove: ChatCommandsService["remove"] = Effect.fn("ChatCommands.remove")(
    function* (name) {
      const existing = yield* store.readChatCommand(name)
      if (Option.isNone(existing)) {
        return yield* UnknownChatCommand.make({ name })
      }
      yield* store.deleteChatCommand(name)
      yield* Effect.logInfo(`Deleted the ${existing.value.name} Chat Command`)
    },
    (self) => lock.withPermit(self),
  )

  return ChatCommands.of({ create, update, remove })
})

/**
 * The Broadcaster's writes to the Channel's Chat Commands. Each runs under
 * the Channel's one lock, so a write never interleaves with an Invocation
 * being answered, and each clears the Cooldown so a corrected reply can be
 * checked at once.
 */
export class ChatCommands extends Context.Service<ChatCommands, ChatCommandsService>()(
  "@twitch-integrations/api/ChatCommands",
) {
  static readonly layer: Layer.Layer<ChatCommands, never, ChannelStore | ChannelLock> =
    Layer.effect(ChatCommands)(make)
}
