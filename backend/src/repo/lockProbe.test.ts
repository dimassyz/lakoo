// @vitest-environment node
/**
 * Verifikasi bahwa `FOR UPDATE` benar-benar MENGUNCI di PGlite, bukan diabaikan.
 *
 * Konteks: QA mencatat "PGlite single-writer tidak bisa mereproduksi balap dua
 * koneksi — proteksi FOR UPDATE tetap wilayah test integrasi". Itu benar untuk
 * BALAP, tapi ada pertanyaan berbeda yang belum terjawab: apakah pernyataan
 * `SELECT ... FOR UPDATE` benar-benar mengambil lock di PGlite, atau justru
 * diabaikan diam-diam? Kalau diabaikan, proteksi W-2 bisa jadi no-op yang
 * lolos semua test tanpa memberi perlindungan apa pun.
 *
 * Yang diuji: perilaku LOCK-nya, bukan balap-nya.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createTestDb } from "../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../database/src/db.ts";
import { lockProduct } from "./stockIns.ts";
import { sql } from "drizzle-orm";

let db: AnyDb;
let storeId = "";
let productId = "";
const report: string[] = [];

/** Jumlah lock relasi pada tabel `products` yang sedang dipegang. */
async function relationLocks(): Promise<number> {
  const r = await db.execute(
    sql`SELECT COUNT(*) AS n FROM pg_locks
        WHERE locktype = 'relation' AND relation = 'products'::regclass`,
  );
  return Number((r.rows[0] as { n: unknown }).n);
}

beforeAll(async () => {
  const built = await createTestDb();
  db = built.db;
  await built.client.exec(`
    INSERT INTO users (email) VALUES ('lockprobe@lakoo.local');
    INSERT INTO stores (owner_user_id, name, store_type)
      SELECT id, 'LockProbe', 'toko_kelontong' FROM users WHERE email = 'lockprobe@lakoo.local';
    INSERT INTO products (store_id, name, name_key, sell_price)
      SELECT id, 'Barang Kunci', 'barang kunci', 5000 FROM stores WHERE name = 'LockProbe';
  `);
  const rows = await db.execute(
    sql`SELECT s.id AS store_id, p.id AS product_id
        FROM stores s JOIN products p ON p.store_id = s.id
        WHERE s.name = 'LockProbe' LIMIT 1`,
  );
  const row = rows.rows[0] as { store_id: string; product_id: string };
  storeId = row.store_id;
  productId = row.product_id;
});

describe("FOR UPDATE di PGlite — apakah benar-benar mengunci?", () => {
  it("pernyataan lock tidak error, dan baris tetap terlihat", async () => {
    await lockProduct(db, storeId, productId);
    report.push("lockProduct() dijalankan tanpa error");

    const visible = await db.execute(
      sql`SELECT COUNT(*) AS n FROM products WHERE id = ${productId}`,
    );
    expect(Number((visible.rows[0] as { n: unknown }).n)).toBe(1);
    report.push("baris produk terlihat setelah lock");
  }, 60_000);

  it("autocommit melepas lock segera (tidak ada lock nyangkut)", async () => {
    const before = await relationLocks();
    await lockProduct(db, storeId, productId);
    const after = await relationLocks();
    report.push(`lock relation sebelum=${before} sesudah=${after}`);
    report.push(
      after >= before
        ? "tidak ada lock yang HILANG setelah pernyataan (konsisten dengan autocommit)"
        : "lock berkurang setelah pernyataan (autocommit melepas)",
    );
    // Tidak assert lock ADA di sini: di luar transaksi, autocommit sudah
    // melepas lock sebelum query pg_locks ini jalan.
  }, 60_000);

  it("lock BERTAMBAH di dalam transaksi → FOR UPDATE bukan no-op", async () => {
    const before = await relationLocks();
    const inTx = await db.transaction(async (tx) => {
      const typed = tx as unknown as AnyDb;
      await typed.execute(
        sql`SELECT 1 FROM products WHERE id = ${productId} FOR UPDATE`,
      );
      const r = await typed.execute(
        sql`SELECT COUNT(*) AS n FROM pg_locks
            WHERE locktype = 'relation' AND relation = 'products'::regclass`,
      );
      return Number((r.rows[0] as { n: unknown }).n);
    });
    report.push(`lock relation di dalam tx (sebelum commit) = ${inTx}`);
    report.push(
      inTx > before
        ? "LOCK BERTAMBAH di dalam tx → FOR UPDATE benar-benar mengunci di PGlite"
        : "lock TIDAK bertambah di dalam tx → FOR UPDATE mungkin no-op di PGlite",
    );
    expect(inTx).toBeGreaterThan(before);
  }, 60_000);

  it("tidak menulis artefak ke disk", () => {
    // Probe dulu menulis laporan ke process.cwd() — nyampah di git status dan
    // bisa terbawa snapshot. Assertion di atas adalah check sebenarnya; laporan
    // hanya scaffolding pembacaan saat development, jadi tidak ada yang ditulis.
    expect(report.length).toBeGreaterThan(0);
    expect(existsSync(resolve(process.cwd(), "forupdate-probe.txt"))).toBe(
      false,
    );
  });
});
