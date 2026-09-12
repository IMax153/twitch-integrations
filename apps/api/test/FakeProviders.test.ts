import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { FakeProviders } from "./FakeProviders.ts"

/** The control service and the closed `HttpClient` routed to its fake APIs. */
const withFakes = <A, E>(
  body: (providers: FakeProviders["Service"], client: HttpClient.HttpClient) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* FakeProviders, yield* HttpClient.HttpClient)
  }).pipe(Effect.provide(Layer.fresh(FakeProviders.layer)))

describe("FakeProviders", () => {
  it.effect(
    "refuses a request to a hostname no fake API plays, before it reaches the network",
    () =>
      withFakes((providers, client) =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip(
            client.execute(HttpClientRequest.get("https://example.com/anything")),
          )
          assert.instanceOf(failure, HttpClientError.HttpClientError)
          assert.strictEqual(failure.reason._tag, "TransportError")
          assert.deepStrictEqual(yield* providers.received, [])
        }),
      ),
  )

  it.effect("records the decoded JSON body of a Helix request", () =>
    withFakes((providers, client) =>
      Effect.gen(function* () {
        yield* client.execute(
          HttpClientRequest.post("https://api.twitch.tv/helix/channel_points/custom_rewards").pipe(
            HttpClientRequest.setHeader("client-id", "twitch-client-id"),
            HttpClientRequest.bodyJsonUnsafe({ title: "Song Request", cost: 1 }),
          ),
        )
        const received = yield* providers.twitchHelix.received
        assert.strictEqual(received.length, 1)
        assert.strictEqual(received[0]?.method, "POST")
        assert.strictEqual(
          received[0]?.url,
          "https://api.twitch.tv/helix/channel_points/custom_rewards",
        )
        assert.strictEqual(received[0]?.headers["client-id"], "twitch-client-id")
        assert.deepStrictEqual(received[0]?.json, { title: "Song Request", cost: 1 })
        assert.deepStrictEqual(received[0]?.form, {})
      }),
    ),
  )

  it.effect("answers a path a fake API does not serve with a 404 rather than refusing it", () =>
    withFakes((_providers, client) =>
      Effect.gen(function* () {
        const response = yield* client.execute(
          HttpClientRequest.get("https://api.spotify.com/v1/nowhere"),
        )
        assert.strictEqual(response.status, 404)
      }),
    ),
  )

  it.effect("keeps each fake API's requests apart while the shared log keeps their order", () =>
    withFakes((providers, client) =>
      Effect.gen(function* () {
        yield* client.execute(
          HttpClientRequest.post("https://id.twitch.tv/oauth2/token").pipe(
            HttpClientRequest.bodyUrlParams({ grant_type: "client_credentials" }),
          ),
        )
        yield* client.execute(HttpClientRequest.get("https://api.spotify.com/v1/me"))
        yield* client.execute(HttpClientRequest.get("https://id.twitch.tv/oauth2/validate"))
        const urls = (requests: ReadonlyArray<{ readonly url: string }>) =>
          requests.map((request) => request.url)
        assert.deepStrictEqual(urls(yield* providers.received), [
          "https://id.twitch.tv/oauth2/token",
          "https://api.spotify.com/v1/me",
          "https://id.twitch.tv/oauth2/validate",
        ])
        assert.deepStrictEqual(urls(yield* providers.twitchAuth.received), [
          "https://id.twitch.tv/oauth2/token",
          "https://id.twitch.tv/oauth2/validate",
        ])
        assert.deepStrictEqual(urls(yield* providers.spotifyWeb.received), [
          "https://api.spotify.com/v1/me",
        ])
        assert.deepStrictEqual(yield* providers.spotifyAccounts.received, [])
        assert.deepStrictEqual((yield* providers.twitchAuth.received)[0]?.form, {
          grant_type: "client_credentials",
        })
      }),
    ),
  )
})
