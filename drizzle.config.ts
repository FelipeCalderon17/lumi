import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` writes SQL migrations to ./drizzle (no database needed).
// `pnpm db:migrate` applies them to DATABASE_URL: by hand locally, Railway's pre-deploy step in
// production (README § Deploy), never in CI.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
