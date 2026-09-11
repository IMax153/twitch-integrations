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
