import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Expo app. It is a separate build with its own tsconfig and its own
    // React Native runtime, so the Next.js rules and resolver do not apply to it.
    // It is linted by its own config in mobile/.
    "mobile/**",
  ]),
]);

export default eslintConfig;
