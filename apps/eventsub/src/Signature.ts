import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"

/** A webhook message as Twitch signed it: the two headers the signature covers and the raw body. */
export interface SignedMessage {
  readonly messageId: string
  readonly timestamp: string
  readonly body: string
  /** The `Twitch-Eventsub-Message-Signature` header. */
  readonly signature: string
}

/** Whether Twitch, holding the shared secret, produced this message's signature. */
export type Verifier = (message: SignedMessage) => Effect.Effect<boolean>

const subtle = globalThis.crypto.subtle

const encoder = new TextEncoder()

/** Twitch prefixes the hex digest with the algorithm it used. */
const algorithmPrefix = "sha256="

const digestBytes = 32

const hexPair = /^[0-9a-f]{2}$/i

/** The bytes a hex string encodes, or none when it is not one. */
const fromHex = (hex: string): Uint8Array<ArrayBuffer> | undefined => {
  if (hex.length % 2 !== 0) {
    return undefined
  }
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let index = 0; index < bytes.length; index += 1) {
    const pair = hex.slice(index * 2, index * 2 + 2)
    if (!hexPair.test(pair)) {
      return undefined
    }
    bytes[index] = Number.parseInt(pair, 16)
  }
  return bytes
}

/** The digest the signature header carries, or none when the header is not in Twitch's format. */
const presentedDigest = (signature: string): Uint8Array<ArrayBuffer> | undefined => {
  if (!signature.startsWith(algorithmPrefix)) {
    return undefined
  }
  const digest = fromHex(signature.slice(algorithmPrefix.length))
  return digest?.length === digestBytes ? digest : undefined
}

/**
 * A verifier over the shared secret. The HMAC key is imported once, here,
 * so the secret is never handled per request. The check is HMAC-SHA256
 * over message ID, then timestamp, then the raw body, in that order, and
 * the comparison is Web Crypto's `verify`, which is constant time; a
 * header that is not a well-formed digest fails before any comparison.
 */
export const makeVerifier = Effect.fnUntraced(function* (secret: Redacted.Redacted<string>) {
  const key = yield* Effect.promise(() =>
    subtle.importKey(
      "raw",
      encoder.encode(Redacted.value(secret)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    ),
  )
  const verify: Verifier = (message) => {
    const digest = presentedDigest(message.signature)
    if (digest === undefined) {
      return Effect.succeed(false)
    }
    const covered = encoder.encode(`${message.messageId}${message.timestamp}${message.body}`)
    return Effect.promise(() => subtle.verify("HMAC", key, digest, covered))
  }
  return verify
})
