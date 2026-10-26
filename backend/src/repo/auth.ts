import { eq, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { sessions, stores, users } from "../../../database/src/schema.ts";

export type UserRow = typeof users.$inferSelect;
export type StoreRow = typeof stores.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

/** `returning()` bertipe array; baris yang seharusnya ada tapi hilang = bug, bukan nilai valid. */
function first<T>(rows: T[], what: string): T {
  const [row] = rows;
  if (row === undefined) throw new Error(`${what} gagal tersimpan`);
  return row;
}

export interface SessionContext {
  session: SessionRow;
  user: UserRow;
  store: StoreRow;
}

export async function findUserByEmail(
  db: AnyDb,
  email: string,
): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row;
}

/** Satu pengguna = satu toko (SPEC §8.1), jadi kepemilikan cukup dari user id. */
export async function findStoreByOwner(
  db: AnyDb,
  userId: string,
): Promise<StoreRow | undefined> {
  const [row] = await db
    .select()
    .from(stores)
    .where(eq(stores.ownerUserId, userId))
    .limit(1);
  return row;
}

/** User + toko dibuat sekaligus; kalau toko gagal, user tidak boleh tertinggal. */
export async function createAccount(
  db: AnyDb,
  input: { email: string; passwordHash: string; storeName: string },
): Promise<{ user: UserRow; store: StoreRow }> {
  return db.transaction(async (tx) => {
    const user = first(
      await tx
        .insert(users)
        .values({ email: input.email, passwordHash: input.passwordHash })
        .returning(),
      "Akun",
    );
    const store = first(
      await tx
        .insert(stores)
        .values({ ownerUserId: user.id, name: input.storeName })
        .returning(),
      "Toko",
    );
    return { user, store };
  });
}

export async function createSession(
  db: AnyDb,
  userId: string,
  tokenHash: Buffer,
  expiresAt: Date,
): Promise<SessionRow> {
  return first(
    await db
      .insert(sessions)
      .values({ userId, tokenHash, expiresAt })
      .returning(),
    "Sesi",
  );
}

/** Lookup sesi berdasarkan hash token; token asli tidak pernah disimpan. */
export async function findSessionByHash(
  db: AnyDb,
  tokenHash: Buffer,
): Promise<SessionContext | undefined> {
  const [row] = await db
    .select({ session: sessions, user: users, store: stores })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(stores, eq(stores.ownerUserId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function deleteSessionByHash(
  db: AnyDb,
  tokenHash: Buffer,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/** Perpanjang masa berlaku + catat aktivitas terakhir (SPEC §8.1). */
export async function renewSession(
  db: AnyDb,
  sessionId: string,
  expiresAt: Date,
  now: Date,
): Promise<void> {
  await db
    .update(sessions)
    .set({ expiresAt, lastSeenAt: now })
    .where(eq(sessions.id, sessionId));
}

/** Buang sesi kedaluwarsa; dipakai cron harian dan saat lookup. */
export async function deleteExpiredSessions(
  db: AnyDb,
  now: Date,
): Promise<number> {
  const result = await db.execute(
    sql`DELETE FROM sessions WHERE expires_at <= ${now.toISOString()}`,
  );
  return result.rowCount ?? 0;
}
