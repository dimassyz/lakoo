import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { AnyDb } from "../db.ts";
import * as schema from "../schema.ts";

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

  // `search_path` disetel per-KONEKSI (bukan sekali di client migrasi): kalau
  // tidak, query drizzle berikutnya mencari tabel di `public` yang kosong dan
  // semua tes gagal "relation does not exist" padahal migrasi sukses.
  const pool = new Pool({
    connectionString: url,
    max: 1,
    options: "-c search_path=perf",
  });
  try {
    // Skema terpisah supaya tidak menabrak apa pun yang sudah ada di database itu.
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS perf`);
      await client.query(`SET search_path TO perf`);
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

/**
 * Postgres in-process untuk test (SPEC §3.3 — tanpa Docker, jalan di Windows).
 * Migrasi yang sama dengan produksi yang diterapkan, supaya constraint dan
 * partial index ikut teruji.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite({ extensions: { citext } });
  for (const file of migrationFiles()) {
    await client.exec(readMigration(file));
  }
  return {
    client: {
      close: () => client.close(),
      exec: (q: string) => client.exec(q),
    },
    db: drizzle(client, { schema }),
  };
}
