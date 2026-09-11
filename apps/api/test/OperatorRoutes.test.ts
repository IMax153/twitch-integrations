import { assert, describe, it } from "@effect/vitest"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { makeOperatorWorld, operatorIdentity, type SendOptions } from "./OperatorHarness.ts"
import { authorizedConnection } from "./fixtures.ts"

const asOperator = { identity: operatorIdentity }

const decodeConnections = Schema.decodeUnknownEffect(
  Schema.Array(ConnectionSummary).annotate({ identifier: "Connections" }),
)

const world = Effect.map(makeOperatorWorld, (world) => {
  const send = (method: "GET" | "POST", path: string, options?: SendOptions) =>
    world.send(new Request(`https://worker.example${path}`, { method }), options)
  const get = (path: string, options?: SendOptions) => send("GET", path, options)
  const getConnections = Effect.gen(function* () {
    const response = yield* get("/setup/api/connections", asOperator)
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    return yield* decodeConnections(yield* Effect.promise(() => response.json()))
  })
  return { ...world, send, get, getConnections }
})

describe("operator routes", () => {
  it.effect.each(["/setup", "/setup/api/connections"])(
    "refuses GET %s without an Access context",
    (path) =>
      Effect.gen(function* () {
        const { get } = yield* world
        const response = yield* get(path)
        assert.strictEqual(response.status, 403)
      }),
  )

  it.effect.each(["/oauth/spotify/authorize", "/oauth/nope", "/setup/anything"])(
    "refuses POST %s without an Access context even when no route matches",
    (path) =>
      Effect.gen(function* () {
        const { send } = yield* world
        const response = yield* send("POST", path)
        assert.strictEqual(response.status, 403)
      }),
  )

  it.effect("leaves routes outside the operator prefixes public", () =>
    Effect.gen(function* () {
      const { get } = yield* world
      const response = yield* get("/")
      assert.strictEqual(response.status, 404)
    }),
  )

  it.effect("describes one Not Configured Connection per Provider", () =>
    Effect.gen(function* () {
      const { getConnections } = yield* world
      assert.deepStrictEqual(yield* getConnections, [
        { provider: "spotify", status: "Not Configured" },
        { provider: "twitch", status: "Not Configured" },
      ])
    }),
  )

  it.effect("describes the status of a stored Connection for its Provider only", () =>
    Effect.gen(function* () {
      const { stores, getConnections } = yield* world
      yield* stores.spotify.writeConnection(authorizedConnection)
      assert.deepStrictEqual(yield* getConnections, [
        { provider: "spotify", status: "Authorized" },
        { provider: "twitch", status: "Not Configured" },
      ])
    }),
  )

  it.effect("answers 404 for an unknown API path", () =>
    Effect.gen(function* () {
      const { get } = yield* world
      const response = yield* get("/setup/api/nope", asOperator)
      assert.strictEqual(response.status, 404)
    }),
  )
})
