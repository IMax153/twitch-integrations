import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { AsyncData } from "foldkit"
import type { HtmlBuilder } from "foldkit/html"
import type { Message } from "./message.ts"
import { staleAfterMs } from "./model.ts"

export const elapsed = (since: number, now: number): string => {
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export const isOutdated = <A>(
  data: AsyncData.AsyncData<A, string>,
  maybeCheckedAt: Option.Option<number>,
  now: number,
) =>
  AsyncData.isStale(data) ||
  Option.match(maybeCheckedAt, {
    onNone: () => true,
    onSome: (checkedAt) => now - checkedAt >= staleAfterMs,
  })

export const freshnessView = <A>(
  data: AsyncData.AsyncData<A, string>,
  maybeCheckedAt: Option.Option<number>,
  now: number,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class("freshness")],
    [
      Option.match(maybeCheckedAt, {
        onNone: () => h.p([], [AsyncData.isPending(data) ? "Checking…" : "Not checked yet"]),
        onSome: (checkedAt) =>
          h.p(
            [h.Class(isOutdated(data, maybeCheckedAt, now) ? "warning-text" : "muted")],
            [
              `${isOutdated(data, maybeCheckedAt, now) ? "Stale · " : ""}Checked ${elapsed(checkedAt, now)} ago${AsyncData.isPending(data) ? " · Refreshing…" : ""}`,
            ],
          ),
      }),
      Option.match(AsyncData.getError(data), {
        onNone: () => h.empty,
        onSome: (error) => h.p([h.Class("error-text"), h.Role("alert")], [error]),
      }),
    ],
  )

export const dateView = (
  label: string,
  maybeAt: Option.Option<DateTime.Utc>,
  h: HtmlBuilder<Message>,
) =>
  Option.match(maybeAt, {
    onNone: () => h.empty,
    onSome: (at) =>
      h.div(
        [h.Class("detail-row")],
        [
          h.dt([], [label]),
          h.dd([], [h.time([h.Datetime(DateTime.formatIso(at))], [DateTime.formatIso(at)])]),
        ],
      ),
  })
