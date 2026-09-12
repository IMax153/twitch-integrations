import * as Array from "effect/Array"
import * as Option from "effect/Option"
import * as Result from "effect/Result"
import { AsyncData, Update, type Runtime } from "foldkit"
import { evo } from "foldkit/struct"
import { FetchChannel, FetchConnections } from "./command.ts"
import { Message } from "./message.ts"
import { type Flags, type Model, refreshIntervalMs } from "./model.ts"

export { Flags, Model } from "./model.ts"
export { Message } from "./message.ts"
export { FetchChannel, FetchConnections } from "./command.ts"
export { view } from "./view.ts"

type UpdateReturn = Update.Return<Model, Message>

export const init: Runtime.ApplicationInit<Model, Message, Flags> = (flags) => ({
  model: {
    connections: flags.isVisible ? AsyncData.Loading() : AsyncData.Idle(),
    channel: flags.isVisible ? AsyncData.Loading() : AsyncData.Idle(),
    maybeResult: flags.maybeResult,
    maybeConnectionsCheckedAt: Option.none(),
    maybeChannelCheckedAt: Option.none(),
    now: flags.now,
    lastRefreshStartedAt: flags.now,
    isVisible: flags.isVisible,
    isQueueOpen: false,
    isHeldOpen: false,
    isReadinessOpen: false,
    expandedProviders: [],
  },
  commands: flags.isVisible ? [FetchConnections(), FetchChannel()] : Array.empty(),
})

const refreshConnections = (model: Model): UpdateReturn =>
  Option.match(AsyncData.revalidateOrLoad(model.connections), {
    onNone: () => ({ model }),
    onSome: (connections) => ({
      model: evo(model, { connections: () => connections }),
      commands: [FetchConnections()],
    }),
  })

const refreshChannel = (model: Model): UpdateReturn =>
  Option.match(AsyncData.revalidateOrLoad(model.channel), {
    onNone: () => ({ model }),
    onSome: (channel) => ({
      model: evo(model, { channel: () => channel }),
      commands: [FetchChannel()],
    }),
  })

const refresh = (model: Model): UpdateReturn =>
  Update.combine(evo(model, { lastRefreshStartedAt: () => model.now }), [
    refreshConnections,
    refreshChannel,
  ])

const tick =
  (model: Model) =>
  ({ now }: typeof Message.TickedClock.Type): UpdateReturn => {
    const next = evo(model, { now: () => now })
    return next.isVisible && now - next.lastRefreshStartedAt >= refreshIntervalMs
      ? refresh(next)
      : { model: next }
  }

const updateVisibility =
  (model: Model) =>
  ({ isVisible, now }: typeof Message.UpdatedVisibility.Type): UpdateReturn => {
    const next = evo(model, { isVisible: () => isVisible, now: () => now })
    return isVisible && !model.isVisible ? refresh(next) : { model: next }
  }

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededFetchConnections: ({ connections, checkedAt }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.succeed(connections)),
        maybeConnectionsCheckedAt: () => Option.some(checkedAt),
        now: () => Math.max(model.now, checkedAt),
      }),
    }),
    FailedFetchConnections: ({ error }) => ({
      model: evo(model, {
        connections: (current) => AsyncData.settle(current, Result.fail(error)),
      }),
    }),
    SucceededFetchChannel: ({ channel, checkedAt }) => ({
      model: evo(model, {
        channel: (current) => AsyncData.settle(current, Result.succeed(channel)),
        maybeChannelCheckedAt: () => Option.some(checkedAt),
        now: () => Math.max(model.now, checkedAt),
      }),
    }),
    FailedFetchChannel: ({ error }) => ({
      model: evo(model, { channel: (current) => AsyncData.settle(current, Result.fail(error)) }),
    }),
    ClickedReload: () => refresh(model),
    TickedClock: tick(model),
    UpdatedVisibility: updateVisibility(model),
    ToggledQueue: ({ isOpen }) => ({ model: evo(model, { isQueueOpen: () => isOpen }) }),
    ToggledHeld: ({ isOpen }) => ({ model: evo(model, { isHeldOpen: () => isOpen }) }),
    ToggledReadiness: ({ isOpen }) => ({ model: evo(model, { isReadinessOpen: () => isOpen }) }),
    ToggledConnection: ({ provider, isOpen }) => ({
      model: evo(model, {
        expandedProviders: (current) =>
          isOpen
            ? Array.dedupe([...current, provider])
            : Array.filter(current, (value) => value !== provider),
      }),
    }),
  })
