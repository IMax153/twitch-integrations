import foldkitRecommended from "@foldkit/oxlint-plugin/recommended.json" with { type: "json" }
import {
  antipattern,
  correctness,
  effectNative,
  recommended,
  style,
} from "@effect/tsgo/oxlint-presets"
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
    extends: [recommended, antipattern, correctness, effectNative, style, foldkitPreset],
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
      // A library convention: a pipeable overload on every exported function
      // of two or more parameters. The apps export plain functions, and
      // Foldkit's `update` and `view` have a fixed signature.
      "effecttsgo/missing-pipeable-signature": "off",
    },
    overrides: [
      {
        // A test provides its layers itself: each test is an entry point.
        files: ["**/test/**"],
        rules: { "effecttsgo/strict-effect-provide": "off" },
      },
    ],
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
