import { defineConfig } from "drizzle-kit";

// Migrations are generated into ./drizzle but not run in Phase 0.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
