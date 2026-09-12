import { assert, describe, it } from "@effect/vitest"
import * as Data from "effect/Data"
import { describeFailure } from "../src/Failure.ts"

class HelixRequestFailed extends Data.TaggedError("HelixRequestFailed")<{
  readonly operation: string
  readonly reason: { readonly _tag: string; readonly status?: number }
}> {}

describe("describeFailure", () => {
  it("writes a tagged error's fields beside its stack", () => {
    const described = describeFailure(
      new HelixRequestFailed({
        operation: "list rewards",
        reason: { _tag: "Status", status: 403 },
      }),
    )
    assert.match(described, /^HelixRequestFailed/)
    assert.include(described, '"operation":"list rewards"')
    assert.include(described, '"status":403')
  })

  it("leaves a plain error to its stack", () => {
    const described = describeFailure(new Error("boom"))
    assert.match(described, /^Error: boom/)
    assert.notInclude(described, "{}")
  })

  it("renders a non-error as JSON", () => {
    assert.strictEqual(describeFailure({ _tag: "Gone", id: 1 }), '{"_tag":"Gone","id":1}')
  })
})
