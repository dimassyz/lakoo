import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Neon (produksi), PGlite (test in-process), dan node-postgres (perf test
 * native PG via `PERF_DATABASE_URL`) sama-sama memenuhi bentuk ini.
 */
export type AnyDb =
  | NeonDatabase<typeof schema>
  | PgliteDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

/**
 * Klien Neon (SPEC §3.3). Pool WebSocket mendukung transaksi, yang dibutuhkan
 * alur all-or-nothing rekap (SPEC §5.8). Pool dikembalikan supaya skrip bisa
 * menutupnya dan proses tidak menggantung.
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset — lihat .env.example");
  }
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}
