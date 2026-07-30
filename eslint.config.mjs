import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore is the conventional signal for a binding that is
      // required by a signature (interface implementations, catch clauses)
      // but deliberately unused in this particular implementation.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app and already excluded from tsconfig: Anchor
    // on-chain program tests (Mocha/ts-node toolchain) and throwaway scripts.
    // Linting them with the app's React/Next rules reports noise, not defects.
    "tests/**",
    "scratch/**",
    "target/**",
    "programs/**",
  ]),
]);

export default eslintConfig;
