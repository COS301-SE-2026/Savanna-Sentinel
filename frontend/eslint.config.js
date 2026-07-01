import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    globalIgnores(["dist", "coverage", "web-build"]),
    {
        ignores: ["src/components/ui", "vite.config.ts"],
    },
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "@stylistic": stylistic,
            react: reactPlugin,
        },
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            globals: globals.browser,
            parser: tseslint.parser,
            parserOptions: {
                project: ["./tsconfig.app.json"],
                tsconfigRootDir: import.meta.dirname,
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: "19.2",
            },
        },
        rules: {
            //Enforce strict equality
            eqeqeq: ["error", "always"],

            "no-var": "error",
            "prefer-const": "error",

            //typescript rules
            //If overloads are not consecutive, throw an error
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/array-type": ["error", { default: "array" }],

            //Enforce variable names according to standard
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "variable",
                    types: ["boolean"],
                    //Eslint will strip out the is has should words when parsing due to the prefix rule, so Pascal is used to avoid the error.
                    //Camel should be used in all cases
                    format: ["PascalCase"],
                    prefix: ["is", "has", "should", "can", "show"],
                },
                {
                    selector: "variable",
                    types: ["function"],
                    format: ["camelCase", "PascalCase"],
                },
                {
                    selector: ["function", "method"],
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "variable",
                    format: ["camelCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: ["typeLike"],
                    format: ["PascalCase"],
                },
                {
                    selector: "variable",
                    modifiers: ["global"],
                    format: ["UPPER_CASE", "camelCase"],
                },
            ],

            "react/destructuring-assignment": ["error", "always"],

            "@stylistic/line-comment-position": [
                "error",
                { position: "above" },
            ],
        },
    },
]);
