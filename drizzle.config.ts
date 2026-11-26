import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (url === undefined) {
  throw new Error("DATABASE_URL is not set; run drizzle-kit through the Makefile");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  // TypeScript fields are camelCase, columns snake_case. Must match the
  // `casing` passed to drizzle() in lib/db/client.ts.
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
});
