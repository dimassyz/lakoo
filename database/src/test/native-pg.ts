import { createTestDb } from "./pglite.ts";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "../schema.ts";
import type { AnyDb } from "../db.ts";

/** Test selalu dijalankan dari root repo (`pnpm test`). */
const MIGRATIONS_DIR = resolve(process.cwd(), "database/drizzle");

/**
 * Bentuk seragam untuk kedua jalur. `db` cukup longgar untuk diterima
 * `seedDemoTemplate` (`AnyDb`) sekaligus `productStats` (`SqlRunner`);
 * `client.close()` seragam supaya `afterAll` tidak perlu bercabang.
 */
export interface TestDb {
  client: {
    close(): Promise<unknown>;
    exec(query: string): Promise<unknown>;
  };
  db: AnyDb;
}

/**
 * Perf test diukur di **Postgres native** bila `PERF_DATABASE_URL` disetel
 * (SPEC §4.2 — lingkungan production-like, bukan PGlite/WASM di runner bersama).
 * Yang diukur adalah biaya QUERY, jadi lingkungan ukurnya harus yang sah.
 *
 * Kontrak, persis keputusan tech-lead:
 * - `PERF_DATABASE_URL` tidak disetel → PGlite (jalur cepat untuk 38 file test lain)
 * - disetel → Postgres native, **schema dari file migrasi yang SAMA** dengan produksi
 * - koneksi gagal → **lempar error, TIDAK fallback ke PGlite**: fallback akan
 *   membuat angka PGlite menyamar sebagai angka native, dan itu lebih buruk
 *   daripada gate merah yang jujur
 * - seed tidak diukur; hanya query-nya
 */
export async function createPerfDb(): Promise<TestDb> {
  const url = process.env.PERF_DATABASE_URL;
  if (url === undefined || url === "") return createTestDb();

  // TANPA skema custom dan TANPA `search_path` — migrasi drizzle sudah
  // berkualifikasi `"public".` (25 kemunculan di 0000_init.sql), sementara
  // kolom mereferensikan tipe TANPA kualifikasi. Skema `perf` + search_path
  // membuat resolusi nama tak-berkualifikasi mencari di skema yang kosong →
  // "type plan_source does not exist" (terverifikasi di CI run pertama PR #8).
  // Container DB sekali-pakai dan fresh tiap run, jadi isolasi skema nol
  // manfaat — apply apa adanya di `public`, search_path default.
  const pool = new Pool({
    connectionString: url,
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      for (const file of migrationFiles()) {
        await client.query(readMigration(file));
      }
    } finally {
      client.release();
    }
    return {
      client: {
        close: () => pool.end(),
        exec: async (query: string) => {
          const c = await pool.connect();
          try {
            return await c.query(query);
          } finally {
            c.release();
          }
        },
      },
      db: drizzlePg(pool, { schema }),
    };
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw new Error(
      `PERF_DATABASE_URL disetel tapi koneksi/migrasi gagal: ${
        error instanceof Error ? error.message : String(error)
      }. Tidak ada fallback ke PGlite.`,
    );
  }
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function readMigration(file: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, file), "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  );
}
