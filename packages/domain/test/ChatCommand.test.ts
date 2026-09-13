import { assert, describe, it } from "@effect/vitest"
import {
  type ChatCommand,
  ChatCommandDraft,
  ChatCommandName,
  ChatCommandResponse,
  defaultCooldown,
  matchChatCommand,
  requiredChatScopes,
} from "@twitch-integrations/domain/ChatCommand"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const decodeName = Schema.decodeUnknownExit(ChatCommandName)
const decodeResponse = Schema.decodeUnknownExit(ChatCommandResponse)
const decodeDraft = Schema.decodeUnknownExit(ChatCommandDraft)
const isFailure = (exit: { _tag: string }): boolean => exit._tag === "Failure"

const command = (name: string, status: ChatCommand["status"] = "Enabled"): ChatCommand => ({
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
      assert.isFalse(isFailure(decodeName(name)))
    })
  }

  const rejected = ["", "to day", "today!", "!today", "to-day", "héllo", "x".repeat(33), " today"]
  for (const name of rejected) {
    it(`rejects ${JSON.stringify(name)}`, () => {
      assert.isTrue(isFailure(decodeName(name)))
    })
  }
})

describe("ChatCommandResponse", () => {
  const accepted = ["Working on the API today.", "x", "y".repeat(500)]
  for (const response of accepted) {
    it(`accepts a response of ${response.length} characters`, () => {
      assert.isFalse(isFailure(decodeResponse(response)))
    })
  }

  const rejected = ["", "y".repeat(501)]
  for (const response of rejected) {
    it(`rejects a response of ${response.length} characters`, () => {
      assert.isTrue(isFailure(decodeResponse(response)))
    })
  }
})

describe("ChatCommandDraft", () => {
  it("starts Enabled with a ten second Cooldown when only a response is given", () => {
    const draft = Schema.decodeSync(ChatCommandDraft)({ response: "Building the API." })
    assert.strictEqual(draft.status, "Enabled")
    assert.isTrue(Duration.equals(draft.cooldown, Duration.seconds(10)))
  })

  it("takes an explicit Cooldown in milliseconds and an explicit status", () => {
    const draft = Schema.decodeSync(ChatCommandDraft)({
      response: "Building the API.",
      cooldown: 0,
      status: "Disabled",
    })
    assert.strictEqual(draft.status, "Disabled")
    assert.isTrue(Duration.equals(draft.cooldown, Duration.zero))
  })

  it("accepts a Cooldown of exactly one hour", () => {
    const draft = Schema.decodeSync(ChatCommandDraft)({
      response: "Building the API.",
      cooldown: 3_600_000,
    })
    assert.isTrue(Duration.equals(draft.cooldown, Duration.hours(1)))
  })

  const rejected: ReadonlyArray<[label: string, input: unknown]> = [
    ["a negative Cooldown", { response: "x", cooldown: -1 }],
    ["a Cooldown over one hour", { response: "x", cooldown: 3_600_001 }],
    ["an unknown status", { response: "x", status: "Paused" }],
    ["an empty response", { response: "" }],
    ["a missing response", {}],
  ]
  for (const [label, input] of rejected) {
    it(`rejects ${label}`, () => {
      assert.isTrue(isFailure(decodeDraft(input)))
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
    it(`answers ${JSON.stringify(text)} with ${name}`, () => {
      const found = matchChatCommand(text, commands)
      assert.isTrue(Option.isSome(found))
      assert.strictEqual(Option.getOrThrow(found).name, name)
    })
  }

  const unmatched = ["!Today", "!today please", "today", "!", "", "! today", "!todays", "!lurk"]
  for (const text of unmatched) {
    it(`answers ${JSON.stringify(text)} with nothing`, () => {
      assert.isTrue(Option.isNone(matchChatCommand(text, commands)))
    })
  }

  it("answers with nothing when no Chat Commands are defined", () => {
    assert.isTrue(Option.isNone(matchChatCommand("!today", [])))
  })
})

describe("requiredChatScopes", () => {
  it("names the three scopes Twitch requires to read chat over webhooks", () => {
    assert.deepStrictEqual([...requiredChatScopes], ["user:read:chat", "user:bot", "channel:bot"])
  })
})
