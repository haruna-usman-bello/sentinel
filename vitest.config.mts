import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["lib/**/*.test.ts"],
    exclude: ["**/*.db.test.ts", "**/node_modules/**"],
    environment: "node",
  },
});
