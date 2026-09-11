# Schemas

Give every Effect Schema an annotation with an `identifier` matching its name.

```ts
export const ProviderName = Schema.Literals(["spotify", "twitch"]).annotate({
  identifier: "ProviderName",
})
```
