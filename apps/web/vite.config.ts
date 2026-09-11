import { foldkit } from "@foldkit/vite-plugin"
import { defineConfig } from "vite-plus"

const localWorker = "http://localhost:1337"

export default defineConfig({
  base: "/setup/",
  plugins: [foldkit()],
  build: {
    outDir: "dist/client",
  },
  server: {
    proxy: {
      "/setup/api": localWorker,
      "/oauth": localWorker,
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
