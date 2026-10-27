import { defineConfig } from "drizzle-kit";

/** Migrasi dijalankan devops di pipeline deploy sebelum build (SPEC §10.1). */
export default defineConfig({
  schema: "./database/src/schema.ts",
  out: "./database/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
