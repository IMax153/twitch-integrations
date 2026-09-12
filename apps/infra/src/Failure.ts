import * as Effect from "effect/Effect"

/**
 * What a failure looks like in a log line. An Error's stack names only its
 * class when the error is a tagged one, so the fields it was made with,
 * such as a Helix operation and status, are written out beside it. A
 * failure that is not an Error, such as Effect's `ConfigError`, a Schema
 * issue, or an object that arrived over the Durable Object RPC as plain
 * data, would otherwise render as `[object Object]`.
 */
export const describeFailure = (failure: unknown): string => {
  if (!(failure instanceof Error)) {
    return JSON.stringify(failure)
  }
  const fields = JSON.stringify({ ...failure })
  const described = failure.stack ?? failure.message
  return fields === "{}" ? described : `${described}\n${fields}`
}

/** Logs the failure readably before it reaches the platform, which keeps the cause visible in the Worker and object logs. */
export const logFailure = (failure: unknown) => Effect.logError("Failure", describeFailure(failure))

/** The Effect with every failure and defect logged readably before it escapes. */
export const observed = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  self.pipe(Effect.tapError(logFailure), Effect.tapDefect(logFailure))
