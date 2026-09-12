# Effect services and layers

Name a service's default layer `layer`, as a static on the service class. When
a service has more than one layer, suffix the others by what distinguishes
them, such as `layerTest` or `layerMemory`. Do not use `live` or `Live`.

```ts
export class Connections extends Context.Service<Connections, ConnectionsService>()(
  "@twitch-integrations/api/Connections",
) {
  static readonly layer = Layer.effect(Connections)(make)
}
```

Build a service with a module-level `make` Effect that yields its
dependencies, and pass that Effect to `Layer.effect`.

## Functions that return an Effect

A named function whose body is `Effect.gen` is written with `Effect.fn` or
`Effect.fnUntraced`, never as an arrow returning `Effect.gen`. Pass any
trailing combinators, such as `Effect.mapError`, as further arguments rather
than a `.pipe` on the result. Annotate the parameters: the generator's
parameters take no contextual types from the surrounding interface.

- `Effect.fn("Service.method")` for a service's operations and for any
  step that reaches the network or storage, so the call shows up as a span.
- `Effect.fnUntraced` for module-internal helpers and test-support builders,
  where a span would only be noise.

```ts
createReward: Effect.fn("Helix.createReward")(
  function* (token: AccessToken, broadcasterId: string, settings: RewardSettings) {
    ...
  },
  Effect.mapError(failed("create reward")),
),

const createTables = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
  ...
})
```

Two shapes stay as arrows: an anonymous callback handed straight to another
combinator or test runner (`it.effect("...", () => Effect.gen(...))`,
`Effect.map((x) => Effect.gen(...))`), and a helper with its own type
parameter, since `Effect.fn` cannot carry one; say so in a comment there.
