import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import reactHooks from "eslint-plugin-react-hooks"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

import pennant from "./eslint-plugin-pennant.mjs"

const eslintConfig = defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "rust/target/**",
    "python/**",
    "go/**",
    "java/**",
    "kotlin/**",
    "android/**",
    "ios/**",
    "php/**",
    "dotnet/**",
    "flutter/**",
    "eslint-rules/**",
    "eslint-plugin-pennant.mjs",
    "commitlint.config.mjs",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { pennant },
    rules: {
      "pennant/exports-at-bottom": "error",
    },
  },
  {
    files: ["react/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  eslintConfigPrettier,
])

export default eslintConfig
