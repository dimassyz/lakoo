import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof createDb>;

/**
 * Klien Neon (SPEC §3.3). Dibuat per proses: Pool WebSocket Neon mendukung
 * transaksi, yang dibutuhkan alur all-or-nothing rekap (SPEC §5.8).
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset — lihat .env.example");
  }
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
