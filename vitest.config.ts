import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // app/** is included so a route test is not silently collected as zero
    // tests — an omitted glob makes a test file look green while never running.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    // Mirrors tsconfig.json `paths: { "@/*": ["./*"] }`. A plain alias
    // avoids adding vite-tsconfig-paths for a single mapping.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
