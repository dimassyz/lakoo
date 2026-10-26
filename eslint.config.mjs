import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat();

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  ...tseslint.configs.recommended,
  {
    rules: {
      // Ambang dibekukan CODE_STANDARDS.md §2 (SPEC §11)
      complexity: ["warn", 10],
      "max-lines-per-function": ["warn", 60],
    },
  },
];

export default config;
