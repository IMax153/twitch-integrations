import * as Schema from "effect/Schema"

/**
 * The outcome a redirect back to the Operator Page carries in its `result`
 * query parameter. Each value maps to one message shown on the page.
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

export interface OperatorResultMessage {
  readonly kind: "success" | "error"
  readonly text: string
}

const messages: Record<OperatorResult, OperatorResultMessage> = {
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

export const describeOperatorResult = (result: OperatorResult): OperatorResultMessage =>
  messages[result]
