import { assert, describe, it } from "@effect/vitest"
import type { BroadcasterResult } from "@twitch-integrations/domain/BroadcasterResult"
import { ConnectionSummary } from "@twitch-integrations/domain/ConnectionSummary"
import type { ProviderName } from "@twitch-integrations/domain/ProviderName"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import * as Redacted from "effect/Redacted"
import {
  makeBroadcasterWorld,
  broadcasterIdentity,
  type SendOptions,
} from "./BroadcasterHarness.ts"
import type { TokenEndpoint } from "./FakeProviders.ts"
import { authorizedConnection, broadcaster, grantedScenario } from "./fixtures.ts"

const asBroadcaster = { identity: broadcasterIdentity }

const notConfigured = (provider: ProviderName): ConnectionSummary => ({
  provider,
  status: "Not Configured",
  connectedAccount: Option.none(),
  scopes: [],
  expiresAt: Option.none(),
})

const decodeConnections = Schema.decodeUnknownEffect(
  Schema.Array(ConnectionSummary).annotate({ identifier: "Connections" }),
)

const world = Effect.map(makeBroadcasterWorld, (world) => {
  const send = (method: "GET" | "POST", path: string, options?: SendOptions) =>
    world.send(new Request(`https://worker.example${path}`, { method }), options)
  const get = (path: string, options?: SendOptions) => send("GET", path, options)
  const authorize = (provider: string) =>
    send("POST", `/oauth/${provider}/authorize`, asBroadcaster)
  /** Starts an authorization and returns the state value the consent URL carries. */
  const startAttempt = (provider: ProviderName) =>
    Effect.map(authorize(provider), (response) => {
      const consent = new URL(response.headers.get("location") ?? "")
      return { state: consent.searchParams.get("state") ?? "" }
    })
  /** Plays the Provider redirecting the Broadcaster back after consent. */
  const callback = (provider: string, query: Record<string, string>, options?: SendOptions) =>
    get(`/oauth/${provider}/callback?${new URLSearchParams(query)}`, options ?? asBroadcaster)
  const getConnections = Effect.gen(function* () {
    const response = yield* get("/setup/api/connections", asBroadcaster)
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    return yield* decodeConnections(yield* Effect.promise(() => response.json()))
  })
  return {
    ...world,
    sendRequest: world.send,
    send,
    get,
    authorize,
    startAttempt,
    callback,
    getConnections,
  }
})

type World = Effect.Success<typeof world>

/** A way a Spotify callback can fail, and the result the Broadcaster Page is sent. */
interface CallbackFailure {
  readonly name: string
  readonly result: BroadcasterResult
  readonly callback: (world: World) => Effect.Effect<Response>
}

const otherIdentity = { identity: { user_uuid: "not-the-broadcaster", email: "else@example.com" } }

/** The token endpoint failing the exchange in every way the Provider can. */
const exchangeFaults: ReadonlyArray<[string, TokenEndpoint]> = [
  ["a client error", { _tag: "Status", status: 400 }],
  ["a rate limit", { _tag: "Status", status: 429 }],
  ["a server error", { _tag: "Status", status: 500 }],
  ["a network failure", { _tag: "Unreachable" }],
  ["a malformed token response", { _tag: "Malformed" }],
]

const callbackFailures: ReadonlyArray<CallbackFailure> = [
  {
    name: "consent is denied",
    result: "denied",
    callback: ({ startAttempt, callback }) =>
      Effect.flatMap(startAttempt("spotify"), ({ state }) =>
        callback("spotify", { error: "access_denied", state }),
      ),
  },
  {
    name: "the code is missing",
    result: "missing-code",
    callback: ({ startAttempt, callback }) =>
      Effect.flatMap(startAttempt("spotify"), ({ state }) => callback("spotify", { state })),
  },
  {
    name: "the Attempt expired",
    result: "attempt-expired",
    callback: ({ startAttempt, callback }) =>
      Effect.gen(function* () {
        const { state } = yield* startAttempt("spotify")
        yield* TestClock.adjust("10 minutes")
        return yield* callback("spotify", { code: "code-1", state })
      }),
  },
  {
    name: "the callback is replayed",
    result: "attempt-mismatch",
    callback: ({ startAttempt, callback }) =>
      Effect.gen(function* () {
        const { state } = yield* startAttempt("spotify")
        yield* callback("spotify", { error: "access_denied", state })
        return yield* callback("spotify", { code: "code-1", state })
      }),
  },
  {
    name: "another Access identity answers",
    result: "identity-mismatch",
    callback: ({ startAttempt, callback }) =>
      Effect.flatMap(startAttempt("spotify"), ({ state }) =>
        callback("spotify", { code: "code-1", state }, otherIdentity),
      ),
  },
  {
    name: "the state belongs to another Provider",
    result: "attempt-mismatch",
    callback: ({ startAttempt, callback }) =>
      Effect.flatMap(startAttempt("twitch"), ({ state }) =>
        callback("spotify", { code: "code-1", state }),
      ),
  },
  {
    name: "the callback arrives at another origin",
    result: "attempt-mismatch",
    callback: ({ startAttempt, sendRequest }) =>
      Effect.flatMap(startAttempt("spotify"), ({ state }) =>
        sendRequest(
          new Request(
            `https://elsewhere.example/oauth/spotify/callback?${new URLSearchParams({ code: "code-1", state })}`,
          ),
          asBroadcaster,
        ),
      ),
  },
  ...exchangeFaults.map(([fault, token]): CallbackFailure => ({
    name: `the exchange meets ${fault}`,
    result: "exchange-failed",
    callback: ({ providers, startAttempt, callback }) =>
      Effect.gen(function* () {
        yield* providers.set("spotify", { ...grantedScenario, token })
        const { state } = yield* startAttempt("spotify")
        return yield* callback("spotify", { code: "code-1", state })
      }),
  })),
]

describe("broadcaster routes", () => {
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

  it.effect("leaves routes outside the broadcaster prefixes public", () =>
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
        notConfigured("spotify"),
        notConfigured("twitch"),
      ])
    }),
  )

  it.effect("describes the status of a stored Connection for its Provider only", () =>
    Effect.gen(function* () {
      const { stores, getConnections } = yield* world
      yield* stores.spotify.writeConnection(authorizedConnection)
      assert.deepStrictEqual(yield* getConnections, [
        {
          provider: "spotify",
          status: "Authorized",
          connectedAccount: Option.some({ id: "spotify-user-1", displayName: "Max" }),
          scopes: ["user-read-currently-playing", "user-read-playback-state"],
          expiresAt: Option.some(DateTime.makeUnsafe("2026-09-11T13:00:00Z")),
        },
        notConfigured("twitch"),
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
          identity: { email: broadcaster.email },
        })
        assert.strictEqual(response.status, 403)
      }),
    )

    it.effect("does not accept GET on the authorize route", () =>
      Effect.gen(function* () {
        const { get } = yield* world
        const response = yield* get("/oauth/spotify/authorize", asBroadcaster)
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
  })

  describe("completing an authorization", () => {
    it.effect.each(["spotify", "twitch"] as const)(
      "redirects a %s callback to the Broadcaster Page with a success result",
      (provider) =>
        Effect.gen(function* () {
          const { providers, startAttempt, callback } = yield* world
          yield* providers.set(provider, grantedScenario)
          const { state } = yield* startAttempt(provider)
          const response = yield* callback(provider, { code: "code-1", state })
          assert.strictEqual(response.status, 303)
          assert.strictEqual(
            response.headers.get("location"),
            "https://worker.example/setup?result=connected",
          )
        }),
    )

    it.effect("exchanges the code with Spotify using HTTP Basic client authentication", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const { state } = yield* startAttempt("spotify")
        yield* callback("spotify", { code: "code-1", state })
        const [exchange, identity] = yield* providers.received
        assert.strictEqual(exchange?.url, "https://accounts.spotify.com/api/token")
        assert.strictEqual(
          exchange.headers["authorization"],
          `Basic ${btoa("spotify-client-id:spotify-client-secret")}`,
        )
        assert.deepStrictEqual(exchange.form, {
          grant_type: "authorization_code",
          code: "code-1",
          redirect_uri: "https://worker.example/oauth/spotify/callback",
        })
        assert.strictEqual(identity?.url, "https://api.spotify.com/v1/me")
        assert.strictEqual(identity.headers["authorization"], "Bearer granted-access-token")
      }),
    )

    it.effect("exchanges the code with Twitch using the Credentials in the form body", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("twitch", grantedScenario)
        const { state } = yield* startAttempt("twitch")
        yield* callback("twitch", { code: "code-2", state })
        const [exchange, identity] = yield* providers.received
        assert.strictEqual(exchange?.url, "https://id.twitch.tv/oauth2/token")
        assert.isUndefined(exchange.headers["authorization"])
        assert.deepStrictEqual(exchange.form, {
          grant_type: "authorization_code",
          code: "code-2",
          redirect_uri: "https://worker.example/oauth/twitch/callback",
          client_id: "twitch-client-id",
          client_secret: "twitch-client-secret",
        })
        assert.strictEqual(identity?.url, "https://id.twitch.tv/oauth2/validate")
        assert.strictEqual(identity.headers["authorization"], "OAuth granted-access-token")
      }),
    )

    it.effect("reports denied consent and consumes the Attempt", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const { state } = yield* startAttempt("spotify")
        const denied = yield* callback("spotify", { error: "access_denied", state })
        assert.strictEqual(denied.status, 303)
        assert.strictEqual(
          denied.headers.get("location"),
          "https://worker.example/setup?result=denied",
        )
        assert.lengthOf(yield* providers.received, 0)
        // The Attempt is gone: a later callback that does carry a code cannot use it.
        const retry = yield* callback("spotify", { code: "code-1", state })
        assert.strictEqual(
          retry.headers.get("location"),
          "https://worker.example/setup?result=attempt-mismatch",
        )
      }),
    )

    it.effect("reports a missing code without touching the Attempt", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const { state } = yield* startAttempt("spotify")
        const response = yield* callback("spotify", { state })
        assert.strictEqual(
          response.headers.get("location"),
          "https://worker.example/setup?result=missing-code",
        )
        assert.lengthOf(yield* providers.received, 0)
      }),
    )

    it.effect("records a one-use Attempt: a replayed callback is refused", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("twitch", grantedScenario)
        const { state } = yield* startAttempt("twitch")
        yield* callback("twitch", { code: "code-1", state })
        const replay = yield* callback("twitch", { code: "code-1", state })
        assert.strictEqual(
          replay.headers.get("location"),
          "https://worker.example/setup?result=attempt-mismatch",
        )
        assert.lengthOf(yield* providers.received, 2)
      }),
    )

    it.effect("binds the Attempt to the Broadcaster who started it", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback, getConnections } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const { state } = yield* startAttempt("spotify")
        const response = yield* callback(
          "spotify",
          { code: "code-1", state },
          { identity: { user_uuid: "not-the-broadcaster", email: "else@example.com" } },
        )
        assert.strictEqual(
          response.headers.get("location"),
          "https://worker.example/setup?result=identity-mismatch",
        )
        assert.lengthOf(yield* providers.received, 0)
        assert.strictEqual((yield* getConnections)[0]?.status, "Not Configured")
      }),
    )

    it.effect("lets the Attempt expire after ten minutes", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const { state } = yield* startAttempt("spotify")
        yield* TestClock.adjust("10 minutes")
        const response = yield* callback("spotify", { code: "code-1", state })
        assert.strictEqual(
          response.headers.get("location"),
          "https://worker.example/setup?result=attempt-expired",
        )
        assert.lengthOf(yield* providers.received, 0)
      }),
    )

    it.effect.each(callbackFailures)(
      "redirects with $result when $name and leaves the previous Connection untouched",
      (failure) =>
        Effect.gen(function* () {
          const current = yield* world
          yield* current.providers.set("spotify", grantedScenario)
          yield* current.stores.spotify.writeConnection(authorizedConnection)
          const response = yield* failure.callback(current)
          assert.strictEqual(response.status, 303)
          // The redirect stays on whichever origin the callback arrived at.
          const location = new URL(response.headers.get("location") ?? "")
          assert.strictEqual(location.pathname, "/setup")
          assert.strictEqual(location.searchParams.get("result"), failure.result)
          assert.deepStrictEqual(
            yield* current.stores.spotify.readConnection,
            Option.some(authorizedConnection),
          )
        }),
    )

    it.effect("answers 404 for a callback from an unknown Provider", () =>
      Effect.gen(function* () {
        const { callback } = yield* world
        const response = yield* callback("soundcloud", { code: "code-1", state: "state-1" })
        assert.strictEqual(response.status, 404)
      }),
    )

    it.effect("replaces the previous Connection entirely on a second authorization", () =>
      Effect.gen(function* () {
        const { providers, stores, startAttempt, callback, getConnections } = yield* world
        yield* providers.set("spotify", grantedScenario)
        const first = yield* startAttempt("spotify")
        yield* callback("spotify", { code: "code-1", state: first.state })
        yield* providers.set("spotify", {
          token: {
            _tag: "Grant",
            grant: {
              accessToken: "second-access-token",
              refreshToken: Option.some("second-refresh-token"),
              expiresIn: 60,
              scopes: Option.some(["scope-c"]),
            },
          },
          account: { id: "account-2", displayName: "Other" },
        })
        const second = yield* startAttempt("spotify")
        yield* callback("spotify", { code: "code-2", state: second.state })
        const [spotify] = yield* getConnections
        assert.deepStrictEqual(
          spotify?.connectedAccount,
          Option.some({ id: "account-2", displayName: "Other" }),
        )
        assert.deepStrictEqual(spotify.scopes, ["scope-c"])
        // Tokens never reach a response, so the store is the only place to see them replaced.
        const stored = yield* stores.spotify.readConnection
        assert.deepStrictEqual(
          Option.map(stored, (connection) => [
            Redacted.value(connection.accessToken),
            Option.map(connection.refreshToken, Redacted.value),
          ]),
          Option.some(["second-access-token", Option.some("second-refresh-token")]),
        )
      }),
    )

    it.effect("never puts a token in a response", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback, get } = yield* world
        yield* providers.set("twitch", grantedScenario)
        const { state } = yield* startAttempt("twitch")
        const redirect = yield* callback("twitch", { code: "code-1", state })
        const page = yield* get("/setup/api/connections", asBroadcaster)
        const headerLines = (response: Response) =>
          [...response.headers].map(([name, value]) => `${name}: ${value}`)
        const seen = [
          ...headerLines(redirect),
          yield* Effect.promise(() => redirect.text()),
          ...headerLines(page),
          yield* Effect.promise(() => page.text()),
        ].join("\n")
        assert.notInclude(seen, "granted-access-token")
        assert.notInclude(seen, "granted-refresh-token")
      }),
    )

    it.effect("shows the Connected Account, granted scopes, and expiry once authorized", () =>
      Effect.gen(function* () {
        const { providers, startAttempt, callback, getConnections } = yield* world
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-11T12:00:00Z")),
        )
        yield* providers.set("twitch", grantedScenario)
        const { state } = yield* startAttempt("twitch")
        yield* callback("twitch", { code: "code-1", state })
        const [, twitch] = yield* getConnections
        assert.deepStrictEqual(twitch, {
          provider: "twitch",
          status: "Authorized",
          connectedAccount: Option.some({ id: "account-1", displayName: "Max" }),
          scopes: ["scope-a", "scope-b"],
          expiresAt: Option.some(DateTime.makeUnsafe("2026-09-11T13:00:00Z")),
        })
      }),
    )
  })

  it.effect("answers 404 for an unknown API path", () =>
    Effect.gen(function* () {
      const { get } = yield* world
      const response = yield* get("/setup/api/nope", asBroadcaster)
      assert.strictEqual(response.status, 404)
    }),
  )
})
