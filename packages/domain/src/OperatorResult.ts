import * as Schema from "effect/Schema"

/**
 * The outcome a redirect back to the Operator Page carries in its `result`
 * query parameter. The page maps each value to one success or error message.
 */
export const OperatorResult = Schema.Literals([
  "connected",
  "denied",
  "missing-code",
  "attempt-expired",
  "identity-mismatch",
  "attempt-mismatch",
  "exchange-failed",
]).annotate({ identifier: "OperatorResult" })
export type OperatorResult = typeof OperatorResult.Type
