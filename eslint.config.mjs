import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Engine code is framework-free by contract (see CONTRIBUTING.md). Enforce it
  // rather than relying on review to catch a stray import.
  {
    files: ["lib/games/**/*.ts", "lib/standings/**/*.ts"],
    ignores: ["lib/games/**/ui.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "next", "next/*", "@supabase/*"],
              message:
                "Engine code must stay pure TypeScript. Put UI in ui.tsx and data access in lib/db.",
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
