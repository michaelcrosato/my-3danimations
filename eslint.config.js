// ESLint flat config: typescript-eslint's recommended rules everywhere, plus the core's determinism and
// no-host rules (DOCTRINE.md principles 5 and 6): no randomness, clock or transcendental host math in core. `npm run
// check` runs it with a cache under .cache/.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/** The host functions whose last bit differs between engines (DOCTRINE.md principle 5; packages/core/src/math/portable.ts). */
const TRANSCENDENTAL = ["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "exp", "expm1", "log", "log1p", "log2", "log10", "pow", "hypot", "cbrt"];

export default defineConfig(
  { ignores: ["**/dist/**", "node_modules/**", ".cache/**", "check-output/**", ".claude/worktrees/**"] },
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
        ...TRANSCENDENTAL.map((property) => ({ object: "Math", property, message: `Hashed paths use the portable math: PORTABLE.${property} (or a MathLike passed in), never the host's Math.${property}.` })),
      ],
      "no-restricted-globals": ["error", "window", "document", "process", "Buffer", "require", "globalThis"],
      "no-restricted-syntax": [
        "error",
        { selector: "BinaryExpression[operator='**']:not([right.value=2])", message: "`**` is the host's pow: use PORTABLE.pow (x ** 2 is exact everywhere)." },
        { selector: "AssignmentExpression[operator='**=']", message: "`**=` is the host's pow: use PORTABLE.pow." },
      ],
    },
  },
  {
    // the portable math itself names the host's functions once, as NATIVE
    files: ["packages/core/src/math/portable.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Core is deterministic: take a seeded RNG instead." },
      ],
    },
  },
);
