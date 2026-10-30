import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Live, paid smoke test only (`pnpm smoke`). Never part of `pnpm test` or CI. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.live.ts"],
    testTimeout: 180_000,
  },
});
