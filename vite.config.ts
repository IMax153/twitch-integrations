import foldkitRecommended from "@foldkit/oxlint-plugin/recommended.json" with { type: "json" }
import { recommended } from "@effect/tsgo/oxlint-presets"
import { type ViteUserConfig, defineConfig } from "vite-plus"

type LintPreset = NonNullable<NonNullable<ViteUserConfig["lint"]>["extends"]>[number]

const foldkitPreset = foldkitRecommended as LintPreset

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
    ignorePatterns: [".agents/**"],
  },
  lint: {
    ignorePatterns: [".direnv"],
    extends: [recommended, foldkitPreset],
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
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: [
            "apps/*/test/**/*.test.ts",
            "packages/*/test/**/*.test.ts",
            "tools/*/test/**/*.test.ts",
          ],
          exclude: [".direnv", "**/node_modules/**", "apps/web/**"],
        },
      },
      "apps/web",
    ],
  },
})
