import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Authorization lives in the data-access layer (handout §7). Nothing outside
  // lib/db may reach the database directly, so no page or action can skip the
  // membership checks there. lib/auth is the one exception: Better Auth needs
  // the client and its own tables. Tests and drizzle.config.ts set up data.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "lib/db/**",
      "lib/auth/**",
      "tests/**",
      "drizzle.config.ts",
      "instrumentation.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*", "postgres"],
              message: "Query through the functions in lib/db, which check access.",
            },
            {
              // Relative spellings too, so `../db/client` is no way round it.
              group: [
                "@/lib/db/client",
                "@/lib/db/schema",
                "@/lib/db/schema/*",
                "**/db/client",
                "**/db/schema",
                "**/db/schema/*",
              ],
              message: "Query through the functions in lib/db, which check access.",
            },
          ],
        },
      ],
    },
  },

  // Engine code is framework-free by contract (see CONTRIBUTING.md). Enforce it
  // rather than relying on review to catch a stray import. Comes after the
  // block above, which it replaces for these files, so it repeats its rules.
  {
    files: ["lib/games/**/*.ts", "lib/standings/**/*.ts"],
    ignores: ["lib/games/**/ui.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "next", "next/*"],
              message: "Engine code must stay pure TypeScript. Put UI in ui.tsx.",
            },
            {
              group: [
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
                "better-auth",
                "better-auth/*",
                "@/lib/db",
                "@/lib/db/*",
                "@/lib/auth",
                "@/lib/auth/*",
                // Relative spellings, as in the general block above.
                "**/db/client",
                "**/db/schema",
                "**/db/schema/*",
                "**/db",
                "**/db/*",
                "**/auth",
                "**/auth/*",
              ],
              message:
                "Engine code must stay pure TypeScript. Data access belongs in lib/db.",
            },
          ],
        },
      ],
    },
  },

  // Must come last: turns off stylistic rules that would fight Prettier.
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
