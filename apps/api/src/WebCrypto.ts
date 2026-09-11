import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"

const webCrypto = globalThis.crypto

// The Foldkit rule wants random values obtained inside an Effect; this is the
// platform adapter that Effect's `Crypto` service wraps, so the raw call is
// the point.
// oxlint-disable-next-line foldkit/no-impure-call-at-decision-time
const randomBytes = (size: number): Uint8Array => webCrypto.getRandomValues(new Uint8Array(size))

const digest: Crypto.Crypto["digest"] = (algorithm, data) =>
  Effect.tryPromise({
    try: () => webCrypto.subtle.digest(algorithm, Uint8Array.from(data)),
    catch: (cause) =>
      PlatformError.systemError({
        module: "Crypto",
        method: "digest",
        _tag: "Unknown",
        description: "Could not compute digest",
        cause,
      }),
  }).pipe(Effect.map((buffer) => new Uint8Array(buffer)))

export const make: Crypto.Crypto = Crypto.make({ randomBytes, digest })

/** Effect's `Crypto` service over the Web Crypto API, which is what workerd provides. */
export const layer: Layer.Layer<Crypto.Crypto> = Layer.succeed(Crypto.Crypto, make)
