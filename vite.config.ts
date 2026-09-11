import { defineConfig } from "vite-plus"
import { recommended } from "@effect/tsgo/oxlint-presets"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
  },
  lint: {
    ignorePatterns: [".direnv"],
    extends: [recommended],
    plugins: ["typescript"],
    jsPlugins: [
      {
        name: "foldkit",
        specifier: "@foldkit/oxlint-plugin",
      },
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    cache: true,
  },
  test: {
    include: [
      "apps/*/test/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "tools/*/test/**/*.test.ts",
    ],
    exclude: [".direnv", "**/node_modules/**"],
    passWithNoTests: true,
  },
})
