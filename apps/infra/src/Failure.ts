import * as Effect from "effect/Effect"

/**
 * A failure reaching the platform is rendered as `[object Object]` when it is
 * not an Error: Effect's `ConfigError` and Schema issues are plain classes,
 * and an object failure arrives over the Durable Object RPC as plain data.
 * Logging it first keeps the cause readable in the Worker and object logs.
 */
export const logFailure = (failure: unknown) =>
  Effect.logError(
    "Failure",
    failure instanceof Error ? (failure.stack ?? failure.message) : JSON.stringify(failure),
  )

/** The Effect with every failure and defect logged readably before it escapes. */
export const observed = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  self.pipe(Effect.tapError(logFailure), Effect.tapDefect(logFailure))
