import "dotenv/config";
import { defineConfig } from "vitest/config";

/**
 * Integration tests that need the seeded database — run with `npm run test:db`
 * after `npm run db:seed`. Kept out of `npm test` so the unit suite stays pure.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.db.test.ts"],
    setupFiles: ["./lib/test/db-setup.ts"],
    fileParallelism: false,
  },
});
