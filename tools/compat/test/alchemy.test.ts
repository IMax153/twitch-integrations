import { expect, test } from "vite-plus/test"
// Exercise the actual CLI in a separate Node process, including its loader.
// oxlint-disable-next-line effecttsgo/node-builtin-import
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { ALCHEMY_PHASE } from "alchemy/Phase"
import { proxyChain } from "alchemy/Util/proxy-chain"

test.each([[], ["deploy"], ["dev"]])("Alchemy CLI help loads for %j", (...args) => {
  const cli = fileURLToPath(new URL("../../../node_modules/alchemy/bin/cli.js", import.meta.url))
  const output = execFileSync(process.execPath, [cli, ...args, "--help"], {
    encoding: "utf8",
    timeout: 30_000,
  })
  expect(output).toContain("alchemy")
})

test("Alchemy's phase configuration works with the installed Effect release", () => {
  expect(Effect.runSync(ALCHEMY_PHASE)).toBe("plan")
})

test("Alchemy proxies yield Effect values and preserve method receivers", () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const client = proxyChain(
        yield* Effect.cached(
          Effect.succeed({
            value: 42,
            read() {
              return Effect.succeed(this.value)
            },
          }),
        ),
      )
      const query = client.read()
      expect(Exit.isExit(query)).toBe(false)
      return yield* query
    }),
  )
  expect(result).toBe(42)
})
