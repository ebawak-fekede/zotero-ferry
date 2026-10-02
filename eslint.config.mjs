import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig([
  globalIgnores(["node_modules/**", "build/**", "dist/**", "coverage/**"]),
  js.configs.recommended,
  { files: ["**/*.mjs"], languageOptions: { globals: globals.node } },
  ...ts.configs.recommended.map((config) => ({ ...config, files: ["src/**/*.ts"] })),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Zotero: "readonly",
        Services: "readonly",
        IOUtils: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "variable", format: ["PascalCase"], filter: { regex: "^[A-Z]", match: true } },
        {
          selector: "variable",
          filter: { regex: "^_", match: false },
          format: ["camelCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          modifiers: ["global", "const"],
          filter: { regex: "^_", match: false },
          format: ["UPPER_CASE", "camelCase", "PascalCase"],
        },
        { selector: "typeLike", format: ["PascalCase"] },
      ],
    },
  },
  {
    files: ["bootstrap.js"],
    languageOptions: { globals: { Zotero: "readonly", Services: "readonly", IOUtils: "readonly" } },
    // Zotero discovers these entry points by name.
    rules: {
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern:
            "^(install|startup|shutdown|uninstall|onMainWindowLoad|onMainWindowUnload)$",
          args: "none",
        },
      ],
    },
  },
  prettier,
]);
