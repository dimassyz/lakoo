import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema.ts";

/** Test selalu dijalankan dari root repo (`pnpm test`). */
const MIGRATIONS_DIR = resolve(process.cwd(), "database/drizzle");

/**
 * Postgres in-process untuk test (SPEC §3.3 — tanpa Docker, jalan di Windows).
 * Migrasi yang sama dengan produksi yang diterapkan, supaya constraint dan
 * partial index ikut teruji.
 */
export async function createTestDb() {
  const client = new PGlite({ extensions: { citext } });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(
      resolve(MIGRATIONS_DIR, file),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await client.exec(sqlText);
  }
  return { client, db: drizzle(client, { schema }) };
}
