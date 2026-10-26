import { sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { ApiError } from "./errors.ts";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

/** SPEC §8.4: 5 / 15 menit per (IP + email). */
export const LOGIN_RULE: RateLimitRule = {
  name: "login",
  limit: 5,
  windowSeconds: 15 * 60,
};
/** SPEC §8.4: 5 / jam per IP. */
export const REGISTER_RULE: RateLimitRule = {
  name: "register",
  limit: 5,
  windowSeconds: 60 * 60,
};

/**
 * Fixed window di tabel `rate_limits`, satu statement atomik supaya dua request
 * bersamaan tidak bisa sama-sama lolos di detik terakhir jendela.
 */
export async function consumeRateLimit(
  db: AnyDb,
  rule: RateLimitRule,
  identity: string,
  now: Date,
): Promise<void> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const startIso = windowStart.toISOString();
  const key = `${rule.name}:${identity}`;

  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${startIso}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = ${startIso}
                   THEN rate_limits.count + 1 ELSE 1 END,
      window_start = ${startIso}
    RETURNING count
  `);

  const rows = (result as unknown as { rows: { count: number | string }[] })
    .rows;
  const count = Number(rows[0]?.count ?? 1);
  if (count <= rule.limit) return;

  const retryAfter = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
  );
  throw new ApiError(
    429,
    "rate_limited",
    "Terlalu banyak percobaan. Coba lagi nanti.",
    {},
    { "Retry-After": String(retryAfter) },
  );
}
