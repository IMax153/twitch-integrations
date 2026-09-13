import { assert, describe, it } from "@effect/vitest"
import {
  type ChatCommand,
  ChatCommandDraft,
  ChatCommandName,
  ChatCommandResponse,
  type ChatCommandStatus,
  Cooldown,
  NewChatCommand,
  defaultCooldown,
  matchChatCommand,
} from "@twitch-integrations/domain/ChatCommand"
import * as Duration from "effect/Duration"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const decodeName = Schema.decodeUnknownExit(ChatCommandName)
const decodeResponse = Schema.decodeUnknownExit(ChatCommandResponse)
const decodeCooldown = Schema.decodeUnknownExit(Cooldown)
const decodeDraft = Schema.decodeUnknownExit(ChatCommandDraft)
const decodeNew = Schema.decodeUnknownExit(NewChatCommand)

const command = (name: string, status: ChatCommandStatus = "Enabled"): ChatCommand => ({
  name: ChatCommandName.make(name),
  response: ChatCommandResponse.make(`the ${name} response`),
  status,
  cooldown: defaultCooldown,
  cooldownUntil: Option.none(),
  lastAnsweredAt: Option.none(),
})

describe("ChatCommandName", () => {
  const accepted = ["today", "Today", "so_far", "a", "1234", "x".repeat(32)]
  for (const name of accepted) {
    it(`accepts ${JSON.stringify(name)}`, () => {
      assert.isTrue(Exit.isSuccess(decodeName(name)))
    })
  }

  const rejected = ["", "to day", "today!", "!today", "to-day", "héllo", "x".repeat(33), " today"]
  for (const name of rejected) {
    it(`rejects ${JSON.stringify(name)}`, () => {
      assert.isTrue(Exit.isFailure(decodeName(name)))
    })
  }
})

describe("ChatCommandResponse", () => {
  const accepted = ["Working on the API today.", "x", "y".repeat(500)]
  for (const response of accepted) {
    it(`accepts a response of ${response.length} characters`, () => {
      assert.isTrue(Exit.isSuccess(decodeResponse(response)))
    })
  }

  const rejected = ["", "y".repeat(501)]
  for (const response of rejected) {
    it(`rejects a response of ${response.length} characters`, () => {
      assert.isTrue(Exit.isFailure(decodeResponse(response)))
    })
  }
})

describe("Cooldown", () => {
  const accepted: ReadonlyArray<[millis: number, duration: Duration.Duration]> = [
    [0, Duration.zero],
    [10_000, Duration.seconds(10)],
    [3_600_000, Duration.hours(1)],
  ]
  for (const [millis, duration] of accepted) {
    it(`accepts ${millis} milliseconds`, () => {
      assert.isTrue(Duration.equals(Schema.decodeSync(Cooldown)(millis), duration))
    })
  }

  const rejected = [-1, 3_600_001]
  for (const millis of rejected) {
    it(`rejects ${millis} milliseconds`, () => {
      assert.isTrue(Exit.isFailure(decodeCooldown(millis)))
    })
  }
})

describe("NewChatCommand", () => {
  it("starts Enabled with a ten second Cooldown when only a name and response are given", () => {
    const created = Schema.decodeSync(NewChatCommand)({
      name: "today",
      response: "Building the API.",
    })
    assert.strictEqual(created.name, "today")
    assert.strictEqual(created.status, "Enabled")
    assert.isTrue(Duration.equals(created.cooldown, Duration.seconds(10)))
  })

  it("takes an explicit Cooldown in milliseconds and an explicit status", () => {
    const created = Schema.decodeSync(NewChatCommand)({
      name: "today",
      response: "Building the API.",
      cooldown: 0,
      status: "Disabled",
    })
    assert.strictEqual(created.status, "Disabled")
    assert.isTrue(Duration.equals(created.cooldown, Duration.zero))
  })

  const rejected: ReadonlyArray<[label: string, input: unknown]> = [
    ["a missing name", { response: "x" }],
    ["an invalid name", { name: "to day", response: "x" }],
    ["a negative Cooldown", { name: "today", response: "x", cooldown: -1 }],
    ["a Cooldown over one hour", { name: "today", response: "x", cooldown: 3_600_001 }],
    ["an unknown status", { name: "today", response: "x", status: "Paused" }],
    ["an empty response", { name: "today", response: "" }],
    ["a missing response", { name: "today" }],
  ]
  for (const [label, input] of rejected) {
    it(`rejects ${label}`, () => {
      assert.isTrue(Exit.isFailure(decodeNew(input)))
    })
  }
})

describe("ChatCommandDraft", () => {
  it("accepts a full edit", () => {
    const draft = Schema.decodeSync(ChatCommandDraft)({
      response: "Building the API.",
      cooldown: 30_000,
      status: "Disabled",
    })
    assert.strictEqual(draft.status, "Disabled")
    assert.isTrue(Duration.equals(draft.cooldown, Duration.seconds(30)))
  })

  const rejected: ReadonlyArray<[label: string, input: unknown]> = [
    ["a missing status, so an edit never re-enables by omission", { response: "x", cooldown: 0 }],
    ["a missing Cooldown", { response: "x", status: "Enabled" }],
  ]
  for (const [label, input] of rejected) {
    it(`rejects ${label}`, () => {
      assert.isTrue(Exit.isFailure(decodeDraft(input)))
    })
  }
})

describe("matchChatCommand", () => {
  const commands = [command("today"), command("socials"), command("Lurk", "Disabled")]

  const matched: ReadonlyArray<[text: string, name: string]> = [
    ["!today", "today"],
    ["  !today  ", "today"],
    ["!today\n", "today"],
    ["!socials", "socials"],
    ["!Lurk", "Lurk"],
  ]
  for (const [text, name] of matched) {
    it(`finds ${name} for ${JSON.stringify(text)}`, () => {
      const found = matchChatCommand(text, commands)
      assert.isTrue(Option.isSome(found))
      assert.strictEqual(Option.getOrThrow(found).name, name)
    })
  }

  const unmatched = ["!Today", "!today please", "today", "!", "", "! today", "!todays", "!lurk"]
  for (const text of unmatched) {
    it(`finds nothing for ${JSON.stringify(text)}`, () => {
      assert.isTrue(Option.isNone(matchChatCommand(text, commands)))
    })
  }

  it("finds nothing when no Chat Commands are defined", () => {
    assert.isTrue(Option.isNone(matchChatCommand("!today", [])))
  })
})
