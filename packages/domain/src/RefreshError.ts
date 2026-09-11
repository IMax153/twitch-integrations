import * as Schema from "effect/Schema"

/**
 * Why the most recent refresh of a Connection failed, and when. Kept on the
 * Connection until a refresh succeeds, so the Broadcaster Page can show it.
 */
export const RefreshError = Schema.Struct({
  message: Schema.String,
  at: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "RefreshError" })
export type RefreshError = typeof RefreshError.Type
