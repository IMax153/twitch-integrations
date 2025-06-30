import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/main.ts"],
  publicDir: "src/static",
  clean: true
})
