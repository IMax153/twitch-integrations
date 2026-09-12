import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

/** One request as a fake API saw it, with a form or JSON body decoded. */
export interface ReceivedRequest {
  readonly hostname: string
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  /** The decoded form body, or empty when the body was not a form. */
  readonly form: Readonly<Record<string, string>>
  /** The decoded JSON body, or undefined when the body was not JSON. */
  readonly json: unknown
}

/** A JSON answer, an empty answer, or none when the fake plays a host that cannot be reached. */
export type FakeResponse =
  | { readonly status: number; readonly body: unknown }
  | { readonly status: number; readonly body?: undefined }
  | "unreachable"

export const respond = (status: number, body: unknown): FakeResponse => ({ status, body })

/** An answer with no body, as Helix gives for a deletion. */
export const respondEmpty = (status: number): FakeResponse => ({ status })

/** What every fake API's scenario can say about timing. */
export interface WithLatency {
  /** How long every answer takes on the Clock, so a test can hold a request in flight. */
  readonly latency?: Duration.Input | undefined
}

/** How one endpoint answers, given the scenario in force and the request as recorded. */
export type Endpoint<Scenario> = (
  scenario: Scenario | undefined,
  received: ReceivedRequest,
) => FakeResponse

/**
 * A fake API: the hostname it plays and its endpoints keyed by method and
 * path, as `GET /v1/me`. A key ending in `/*`, as `GET /v1/tracks/*`,
 * answers every path under it.
 */
export interface FakeApiDefinition<Scenario extends WithLatency> {
  readonly hostname: string
  readonly endpoints: Readonly<Record<string, Endpoint<Scenario>>>
}

/** The control service a test drives one fake API through. */
export interface FakeApiService<Scenario> {
  /** Sets what the API answers from now on. */
  readonly set: (scenario: Scenario) => Effect.Effect<void>
  /** Every request this API has received, oldest first. */
  readonly received: Effect.Effect<ReadonlyArray<ReceivedRequest>>
}

/** What the router needs of a fake API: the hostname it plays and how it answers a recorded request. */
export interface Answering {
  readonly hostname: string
  readonly answer: (received: ReceivedRequest) => Effect.Effect<FakeResponse>
}

/** A fake API wired to the shared request log, ready for the router. */
export interface FakeApi<Scenario> extends Answering {
  readonly service: FakeApiService<Scenario>
}

/** Everything the fake APIs behind one `HttpClient` share: the log every request lands in, in order. */
export interface RequestLog {
  readonly entries: Ref.Ref<ReadonlyArray<ReceivedRequest>>
}

export const makeRequestLog: Effect.Effect<RequestLog> = Effect.map(
  Ref.make<ReadonlyArray<ReceivedRequest>>([]),
  (entries) => ({ entries }),
)

const decodeForm = (request: HttpClientRequest.HttpClientRequest): Record<string, string> =>
  request.body._tag === "Uint8Array" &&
  request.body.contentType.startsWith("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(new TextDecoder().decode(request.body.body)))
    : {}

const decodeJson = (request: HttpClientRequest.HttpClientRequest): unknown =>
  request.body._tag === "Uint8Array" && request.body.contentType.startsWith("application/json")
    ? JSON.parse(new TextDecoder().decode(request.body.body))
    : undefined

const record = (request: HttpClientRequest.HttpClientRequest, url: URL): ReceivedRequest => ({
  hostname: url.hostname,
  method: request.method,
  url: url.toString(),
  headers: { ...request.headers },
  form: decodeForm(request),
  json: decodeJson(request),
})

/** The endpoint answering the request: the one keyed by its exact path, else the one whose `/*` key covers it. */
const endpointFor = <Scenario extends WithLatency>(
  definition: FakeApiDefinition<Scenario>,
  received: ReceivedRequest,
): Endpoint<Scenario> | undefined => {
  const path = `${received.method} ${new URL(received.url).pathname}`
  const exact = definition.endpoints[path]
  if (exact !== undefined) {
    return exact
  }
  const prefix = Object.keys(definition.endpoints).find(
    (key) => key.endsWith("/*") && path.startsWith(key.slice(0, -1)),
  )
  return prefix === undefined ? undefined : definition.endpoints[prefix]
}

/** Builds one fake API over the shared log from its definition. */
export const makeFakeApi = <Scenario extends WithLatency>(
  definition: FakeApiDefinition<Scenario>,
  log: RequestLog,
): Effect.Effect<FakeApi<Scenario>> =>
  // An arrow rather than `Effect.fn`, which cannot carry the type parameter.
  Effect.gen(function* () {
    const scenario = yield* Ref.make<Scenario | undefined>(undefined)
    const service: FakeApiService<Scenario> = {
      set: (next) => Ref.set(scenario, next),
      received: Effect.map(Ref.get(log.entries), (entries) =>
        entries.filter((entry) => entry.hostname === definition.hostname),
      ),
    }
    const answer = Effect.fnUntraced(function* (received: ReceivedRequest) {
      const current = yield* Ref.get(scenario)
      if (current?.latency !== undefined) {
        yield* Effect.sleep(current.latency)
      }
      const endpoint = endpointFor(definition, received)
      return endpoint === undefined
        ? respond(404, { error: "not found" })
        : endpoint(current, received)
    })
    return { hostname: definition.hostname, service, answer }
  })

const refuse = (request: HttpClientRequest.HttpClientRequest, message: string) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({ request, cause: new Error(message) }),
  })

/**
 * A closed `HttpClient` that sends each request to the fake API playing its
 * hostname, records it in the shared log, and refuses every other hostname as
 * if the network did, so no test can reach a live Provider by accident.
 */
export const routeByHostname = (
  apis: ReadonlyArray<Answering>,
  log: RequestLog,
): HttpClient.HttpClient =>
  HttpClient.make((request, url) =>
    Effect.gen(function* () {
      const api = apis.find((candidate) => candidate.hostname === url.hostname)
      if (api === undefined) {
        return yield* refuse(request, `Refused ${request.method} ${url.toString()}`)
      }
      const received = record(request, url)
      yield* Ref.update(log.entries, (entries) => [...entries, received])
      const answer = yield* api.answer(received)
      if (answer === "unreachable") {
        return yield* refuse(request, `${url.host} is unreachable`)
      }
      return HttpClientResponse.fromWeb(
        request,
        answer.body === undefined
          ? new Response(null, { status: answer.status })
          : Response.json(answer.body, { status: answer.status }),
      )
    }),
  )
