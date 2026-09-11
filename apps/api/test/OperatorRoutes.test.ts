import { assert, describe, it } from "@effect/vitest"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import type { AttemptClaim } from "../src/ConnectionStore.ts"
import { makeOperatorWorld, operatorIdentity, type SendOptions } from "./OperatorHarness.ts"
import { authorizedConnection, operator } from "./fixtures.ts"

const asOperator = { identity: operatorIdentity }

const decodeConnections = Schema.decodeUnknownEffect(
  Schema.Array(ConnectionSummary).annotate({ identifier: "Connections" }),
)

const world = Effect.map(makeOperatorWorld, (world) => {
  const send = (method: "GET" | "POST", path: string, options?: SendOptions) =>
    world.send(new Request(`https://worker.example${path}`, { method }), options)
  const get = (path: string, options?: SendOptions) => send("GET", path, options)
  const authorize = (provider: string) => send("POST", `/oauth/${provider}/authorize`, asOperator)
  /** Starts an authorization and returns the state the consent URL carries plus the claim a callback would present. */
  const startAttempt = (provider: ProviderName) =>
    Effect.map(authorize(provider), (response) => {
      const consent = new URL(response.headers.get("location") ?? "")
      const state = consent.searchParams.get("state") ?? ""
      const claim: AttemptClaim = {
        state,
        provider,
        callbackUri: consent.searchParams.get("redirect_uri") ?? "",
        operator,
      }
      return { state, claim }
    })
  const getConnections = Effect.gen(function* () {
    const response = yield* get("/setup/api/connections", asOperator)
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    return yield* decodeConnections(yield* Effect.promise(() => response.json()))
  })
  return { ...world, send, get, authorize, startAttempt, getConnections }
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

  describe("starting an authorization", () => {
    it.effect.each([
      {
        provider: "spotify" as const,
        consentScreen: "https://accounts.spotify.com/authorize",
        clientId: "spotify-client-id",
        scope: "user-modify-playback-state user-read-playback-state user-read-currently-playing",
      },
      {
        provider: "twitch" as const,
        consentScreen: "https://id.twitch.tv/oauth2/authorize",
        clientId: "twitch-client-id",
        scope:
          "channel:read:redemptions channel:manage:redemptions user:read:chat user:write:chat moderator:manage:shoutouts",
      },
    ])("redirects a $provider Connect to its consent screen", ({ provider, ...expected }) =>
      Effect.gen(function* () {
        const { authorize } = yield* world
        const response = yield* authorize(provider)
        assert.strictEqual(response.status, 303)
        const consent = new URL(response.headers.get("location") ?? "")
        const state = consent.searchParams.get("state") ?? ""
        assert.isNotEmpty(state)
        assert.strictEqual(consent.origin + consent.pathname, expected.consentScreen)
        assert.deepStrictEqual(Object.fromEntries(consent.searchParams), {
          client_id: expected.clientId,
          response_type: "code",
          redirect_uri: `https://worker.example/oauth/${provider}/callback`,
          scope: expected.scope,
          state,
        })
      }),
    )

    it.effect("issues a fresh state value for every Connect", () =>
      Effect.gen(function* () {
        const { startAttempt } = yield* world
        const first = yield* startAttempt("spotify")
        const second = yield* startAttempt("spotify")
        assert.notStrictEqual(first.state, second.state)
      }),
    )

    it.effect("refuses an Access identity that lacks a user id or email", () =>
      Effect.gen(function* () {
        const { send } = yield* world
        const response = yield* send("POST", "/oauth/spotify/authorize", {
          identity: { email: operator.email },
        })
        assert.strictEqual(response.status, 403)
      }),
    )

    it.effect("does not accept GET on the authorize route", () =>
      Effect.gen(function* () {
        const { get } = yield* world
        const response = yield* get("/oauth/spotify/authorize", asOperator)
        assert.strictEqual(response.status, 404)
      }),
    )

    it.effect("answers 404 for an unknown Provider", () =>
      Effect.gen(function* () {
        const { authorize } = yield* world
        const response = yield* authorize("soundcloud")
        assert.strictEqual(response.status, 404)
      }),
    )

    it.effect("records a one-use Attempt the callback can consume once", () =>
      Effect.gen(function* () {
        const { stores, startAttempt } = yield* world
        const { claim } = yield* startAttempt("twitch")
        assert.isTrue(yield* stores.twitch.consumeAttempt(claim))
        assert.isFalse(yield* stores.twitch.consumeAttempt(claim))
      }),
    )

    it.effect("binds the Attempt to the Operator who started it", () =>
      Effect.gen(function* () {
        const { stores, startAttempt } = yield* world
        const { claim } = yield* startAttempt("spotify")
        const somebodyElse = { userUuid: "not-the-operator", email: "else@example.com" }
        assert.isFalse(yield* stores.spotify.consumeAttempt({ ...claim, operator: somebodyElse }))
      }),
    )

    it.effect("lets the Attempt expire after ten minutes", () =>
      Effect.gen(function* () {
        const { stores, startAttempt } = yield* world
        const { claim } = yield* startAttempt("spotify")
        yield* TestClock.adjust("10 minutes")
        assert.isFalse(yield* stores.spotify.consumeAttempt(claim))
      }),
    )
  })

  it.effect("answers 404 for an unknown API path", () =>
    Effect.gen(function* () {
      const { get } = yield* world
      const response = yield* get("/setup/api/nope", asOperator)
      assert.strictEqual(response.status, 404)
    }),
  )
})
