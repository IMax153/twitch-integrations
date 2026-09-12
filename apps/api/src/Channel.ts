import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChannelObject, type ChannelObjectShape } from "./ChannelObject.ts"
import type { ReconcileError } from "./ChannelReconcile.ts"

export interface ChannelService {
  /**
   * Runs the Channel's reconcile. In production a failure arrives over the
   * RPC as a plain object carrying the error's tag and fields, so callers
   * match on `_tag` rather than `instanceof`.
   */
  readonly reconcile: Effect.Effect<void, ReconcileError>
}

/** The fixed name the one Channel object is addressed by. */
const channelName = "channel"

/**
 * The service over any way of reaching the Channel object: the namespace
 * stub in production, an in-process object in tests. The object is resolved
 * per call rather than once: at plan time the namespace has no stubs yet,
 * and the Worker's init runs there too.
 */
const fromObject = (object: () => ChannelObjectShape): ChannelService => ({
  reconcile: Effect.suspend(() => object().reconcile()),
})

const make = Effect.map(ChannelObject, (objects) =>
  fromObject(() => objects.getByName(channelName)),
)

/**
 * The Worker's view of the Channel object. In production it wraps the
 * Durable Object namespace RPC; tests provide the object in-process over the
 * same code.
 */
export class Channel extends Context.Service<Channel, ChannelService>()(
  "@twitch-integrations/api/Channel",
) {
  /** Built in the Worker init, where yielding the class registers the binding. */
  static readonly layer = Layer.effect(Channel)(make)
  static readonly fromObject = fromObject
}
