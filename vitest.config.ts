import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // Mirrors tsconfig.json `paths: { "@/*": ["./*"] }`. A plain alias
    // avoids adding vite-tsconfig-paths for a single mapping.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
