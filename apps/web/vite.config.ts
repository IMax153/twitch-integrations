import { foldkit } from "@foldkit/vite-plugin"
import { defineConfig } from "vite-plus"

const localWorker = "http://127.0.0.1:1337"

/**
 * The host the Broadcaster opens the page at under `alchemy dev`. Alchemy
 * fronts this dev server with a proxy that rewrites `Host` to the internal
 * Vite port, and the API Worker derives the OAuth callback origin from the
 * `Host` it receives, so the proxy to the Worker restores the public host.
 */
const devHost = "127.0.0.1:5173"

const toLocalWorker = { target: localWorker, headers: { host: devHost } }

export default defineConfig({
  base: "/setup/",
  plugins: [foldkit()],
  build: {
    outDir: "dist/client",
  },
  server: {
    proxy: {
      "/setup/api": toLocalWorker,
      "/oauth": toLocalWorker,
    },
  },
  test: {
    name: "web",
    include: ["test/**/*.test.ts"],
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    server: {
      deps: {
        inline: ["foldkit"],
      },
    },
  },
})
