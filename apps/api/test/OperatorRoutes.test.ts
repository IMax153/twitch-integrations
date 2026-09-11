import { assert, describe, it } from "@effect/vitest"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { operatorIdentity, sendOperatorRequest, webAssets } from "./OperatorHarness.ts"

type SendOptions = { readonly identity?: typeof operatorIdentity }

const send = (method: "GET" | "POST", path: string, options?: SendOptions) =>
  sendOperatorRequest(new Request(`https://worker.example${path}`, { method }), options)

const get = (path: string, options?: SendOptions) => send("GET", path, options)

const asOperator = { identity: operatorIdentity }

const decodeConnections = Schema.decodeUnknownEffect(Schema.Array(ConnectionSummary))

describe("operator routes", () => {
  it.effect.each(["/setup", "/setup/api/connections", "/setup/assets/app.js"])(
    "refuses GET %s without an Access context",
    (path) =>
      Effect.gen(function* () {
        const response = yield* get(path)
        assert.strictEqual(response.status, 403)
      }),
  )

  it.effect.each(["/oauth/spotify/authorize", "/oauth/nope", "/setup/anything"])(
    "refuses POST %s without an Access context even when no route matches",
    (path) =>
      Effect.gen(function* () {
        const response = yield* send("POST", path)
        assert.strictEqual(response.status, 403)
      }),
  )

  it.effect("leaves routes outside the operator prefixes public", () =>
    Effect.gen(function* () {
      const response = yield* get("/")
      assert.strictEqual(response.status, 404)
    }),
  )

  it.effect.each(["/setup", "/setup/", "/setup/anything/deep"])(
    "serves the Operator Page shell for %s",
    (path) =>
      Effect.gen(function* () {
        const response = yield* get(path, asOperator)
        assert.strictEqual(response.status, 200)
        assert.match(response.headers.get("content-type") ?? "", /^text\/html/)
        assert.strictEqual(yield* Effect.promise(() => response.text()), webAssets["/index.html"])
      }),
  )

  it.effect("answers HEAD for the page without a body", () =>
    Effect.gen(function* () {
      const response = yield* sendOperatorRequest(
        new Request("https://worker.example/setup", { method: "HEAD" }),
        asOperator,
      )
      assert.strictEqual(response.status, 200)
      assert.strictEqual(yield* Effect.promise(() => response.text()), "")
    }),
  )

  it.effect("serves the Operator Page's files", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup/assets/app.js", asOperator)
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^text\/javascript/)
      assert.strictEqual(yield* Effect.promise(() => response.text()), webAssets["/assets/app.js"])
    }),
  )

  it.effect("describes one Not Configured Connection per Provider", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup/api/connections", asOperator)
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
      const connections = yield* decodeConnections(yield* Effect.promise(() => response.json()))
      assert.deepStrictEqual(connections, [
        { provider: "spotify", status: "Not Configured" },
        { provider: "twitch", status: "Not Configured" },
      ])
    }),
  )

  it.effect("does not fall back to the page shell for an unknown API path", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup/api/nope", asOperator)
      assert.strictEqual(response.status, 404)
    }),
  )
})
