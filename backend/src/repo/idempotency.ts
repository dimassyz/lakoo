import { sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";

/** Tag rekaman yang ditulis di dalam transaksi bisnis (W-1). */
export interface IdempotentTag {
  key: string;
  endpoint: string;
  statusCode: number;
}

export interface IdempotentRecord {
  endpoint: string;
  statusCode: number;
  responseBody: unknown;
}

/**
 * Rekaman idempotensi untuk (store, key), bila ada DAN masih dalam jendela
 * replay 7 hari — batas yang sama dengan cleanup cron, supaya kirim ulang
 * setelah seminggu benar-benar memproses ulang (bukan memutar balik respons basi).
 */
export async function findIdempotent(
  db: AnyDb,
  storeId: string,
  key: string,
): Promise<IdempotentRecord | null> {
  const result = await db.execute(
    sql`SELECT endpoint, status_code, response_body FROM idempotency_keys
        WHERE store_id = ${storeId} AND key = ${key}
          AND created_at > now() - interval '7 days'
        LIMIT 1`,
  );
  const row = result.rows[0] as
    | { endpoint: string; status_code: number; response_body: unknown }
    | undefined;
  if (row === undefined) return null;
  return {
    endpoint: row.endpoint,
    statusCode: Number(row.status_code),
    responseBody: row.response_body,
  };
}

/** Catat respons untuk (store, key) supaya kirim ulang tidak menulis dua kali. */
export async function storeIdempotent(
  db: AnyDb,
  storeId: string,
  key: string,
  endpoint: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO idempotency_keys (store_id, key, endpoint, status_code, response_body)
    VALUES (${storeId}, ${key}, ${endpoint}, ${statusCode}, ${JSON.stringify(responseBody)}::jsonb)
    ON CONFLICT (store_id, key) DO NOTHING`);
}
