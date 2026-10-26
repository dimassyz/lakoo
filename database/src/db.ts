import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof createDb>["db"];

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
