import { Effect } from "effect"

export class SongQueue extends Effect.Service<SongQueue>()("app/SongQueue", {
  effect: Effect.gen(function*() {
    return {} as const
  })
}) {}
