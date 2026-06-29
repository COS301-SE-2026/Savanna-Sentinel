import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'web-build']),
  {
    ignores: ["src/components/ui"]
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      "@stylistic": stylistic
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      //Enforce strict equality
      "eqeqeq": ["error", "always"],

      "no-var": "error",
      "prefer-const": "error",

      //typescript rules
      //If overloads are not consecutive, throw an error
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/array-type": ["error", "array"],

      //Enforce variable names according to standard
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "variable",
          "types": ["boolean"],
          "format": ["camelCase"],
          "prefix": ["is", "has", "should", "can"]
        },
        {
          "selector": ["function", "method"],
          "format": ["camelCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": "variable",
          "format": ["camelCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": ["typeLike"],
          "format": ["PascalCase"]
        },
        {
          "selector": "variable",
          "modifiers": ["global"],
          "format": ["UPPER_CASE", "camelCase"]
        },
      ],

      "react/destructuring-assignment": ["error", "always"],

      "@stylistic/line-comment-position": ["error", {"position": "above"}]
    }
  },
])
