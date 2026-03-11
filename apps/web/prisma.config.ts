import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.CONTEXT9_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://context9:context9@localhost:5432/context9";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
