import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // A pooled connection cannot run migrations — they need a session, which
    // a transaction pooler will not give. Point DIRECT_URL at the database
    // itself wherever DATABASE_URL goes through a pooler.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
