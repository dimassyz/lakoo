import { and, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { stores, users } from "../../../database/src/schema.ts";

/** `idempotency_keys` disimpan 7 hari (SPEC §10.1). */
export const IDEMPOTENCY_RETENTION_DAYS = 7;

const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

/**
 * Hapus klon demo yang sudah kedaluwarsa. Menghapus `users` supaya seluruh
 * data toko ikut lewat cascade; toko template tidak pernah tersentuh karena
 * `demo_expires_at`-nya null.
 */
export async function deleteExpiredClones(
  db: AnyDb,
  now: Date,
): Promise<number> {
  const expired = await db
    .select({ ownerUserId: stores.ownerUserId })
    .from(stores)
    .where(
      and(isNotNull(stores.demoExpiresAt), lte(stores.demoExpiresAt, now)),
    );
  if (expired.length === 0) return 0;

  const ids = expired.map((row) => row.ownerUserId);
  const deleted = await db
    .delete(users)
    .where(inArray(users.id, ids))
    .returning();
  return deleted.length;
}

/** Bersihkan tabel operasional (SPEC §10.1 langkah 4). */
export async function cleanupTables(db: AnyDb, now: Date): Promise<void> {
  const cutoff = new Date(
    now.getTime() - IDEMPOTENCY_RETENTION_DAYS * 86_400_000,
  );

  await db.execute(
    sql`DELETE FROM idempotency_keys WHERE created_at < ${cutoff.toISOString()}`,
  );
  // Jendela rate limit terpanjang 24 jam; lewat itu baris tidak mungkin cocok lagi.
  await db.execute(
    sql`DELETE FROM rate_limits WHERE window_start < ${cutoff.toISOString()}`,
  );
  await db.execute(
    sql`DELETE FROM sessions WHERE expires_at <= ${now.toISOString()}`,
  );
}

export async function countDemoClones(db: AnyDb): Promise<number> {
  const rows = await db.execute(
    sql`SELECT COUNT(*) AS n FROM stores WHERE demo_expires_at IS NOT NULL`,
  );
  return num((rows.rows[0] as { n?: unknown } | undefined)?.n);
}
