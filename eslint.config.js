// ESLint flat config: typescript-eslint's recommended rules everywhere, plus the core's determinism and
// no-host rules (DOCTRINE.md principles 5 and 6). `npm run check` runs it with a cache under .cache/.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/dist/**", "node_modules/**", ".cache/**", "check-output/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Core is deterministic: take a seeded RNG instead." },
        { object: "Date", property: "now", message: "Core never reads the clock: take time as an argument." },
        { object: "performance", property: "now", message: "Core never reads the clock: take time as an argument." },
      ],
      "no-restricted-globals": ["error", "window", "document", "process", "Buffer", "require", "globalThis"],
    },
  },
);
