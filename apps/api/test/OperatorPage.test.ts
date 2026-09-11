import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { operatorIdentity, sendOperatorRequest } from "./OperatorHarness.ts"

const get = (path: string, options?: { readonly identity?: typeof operatorIdentity }) =>
  sendOperatorRequest(new Request(`https://worker.example${path}`), options)

const post = (path: string, options?: { readonly identity?: typeof operatorIdentity }) =>
  sendOperatorRequest(new Request(`https://worker.example${path}`, { method: "POST" }), options)

const section = (html: string, provider: string) => {
  const match = html.match(
    new RegExp(`<section data-provider="${provider}">([\\s\\S]*?)</section>`),
  )
  assert.isNotNull(match, `expected a section for ${provider}`)
  return match![1]
}

describe("Operator Page", () => {
  it.effect("refuses the Operator Page without an Access context", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup")
      assert.strictEqual(response.status, 403)
    }),
  )

  it.effect.each(["/setup/anything", "/oauth/spotify/authorize", "/oauth/nope"])(
    "refuses %s without an Access context even when no route matches",
    (path) =>
      Effect.gen(function* () {
        const response = yield* post(path)
        assert.strictEqual(response.status, 403)
      }),
  )

  it.effect("leaves routes outside the operator prefixes public", () =>
    Effect.gen(function* () {
      const response = yield* get("/")
      assert.notStrictEqual(response.status, 403)
    }),
  )

  it.effect("renders one Not Configured section per Provider with a Connect form", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup", { identity: operatorIdentity })
      assert.strictEqual(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/)
      const html = yield* Effect.promise(() => response.text())

      for (const [provider, label] of [
        ["spotify", "Spotify"],
        ["twitch", "Twitch"],
      ]) {
        const html_ = section(html, provider)
        assert.include(html_, `<h2>${label}</h2>`)
        assert.include(html_, "Not Configured")
        assert.include(html_, `<form method="post" action="/oauth/${provider}/authorize">`)
        assert.include(html_, ">Connect<")
      }
    }),
  )

  it.effect("renders a success message from the result query parameter", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup?result=connected", { identity: operatorIdentity })
      const html = yield* Effect.promise(() => response.text())
      assert.match(html, /<p class="result success">[^<]+<\/p>/)
      assert.notMatch(html, /class="result error"/)
    }),
  )

  it.effect("renders an error message from the result query parameter", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup?result=denied", { identity: operatorIdentity })
      const html = yield* Effect.promise(() => response.text())
      assert.match(html, /<p class="result error">[^<]+<\/p>/)
      assert.notMatch(html, /class="result success"/)
    }),
  )

  it.effect("ignores an unknown result value", () =>
    Effect.gen(function* () {
      const response = yield* get("/setup?result=%3Cscript%3E", { identity: operatorIdentity })
      assert.strictEqual(response.status, 200)
      const html = yield* Effect.promise(() => response.text())
      assert.notMatch(html, /class="result/)
      assert.notInclude(html, "<script>")
    }),
  )
})
