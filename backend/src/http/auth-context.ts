import type { Context } from "hono";
import type { AnyDb } from "../../../database/src/db.ts";
import { unauthenticated } from "./errors.ts";
import type { SessionContext } from "../repo/auth.ts";
import {
  deleteSessionByHash,
  findSessionByHash,
  renewSession,
} from "../repo/auth.ts";
import {
  SESSION_TTL_SECONDS,
  hashToken,
  readSessionToken,
  sessionCookie,
  shouldRenew,
} from "./session.ts";

export interface SessionDeps {
  db: AnyDb;
  now: () => Date;
}

/**
 * Sesi aktif untuk request ini, atau `unauthenticated`.
 * `storeId` selalu berasal dari sesi — tidak pernah dari body/query (SPEC §8.1).
 */
export async function currentSession(
  c: Context,
  deps: SessionDeps,
): Promise<SessionContext> {
  const token = readSessionToken(c.req.header("cookie"));
  if (token === undefined) throw unauthenticated();

  const tokenHash = hashToken(token);
  const found = await findSessionByHash(deps.db, tokenHash);
  if (found === undefined) throw unauthenticated();

  const now = deps.now();
  if (found.session.expiresAt.getTime() <= now.getTime()) {
    await deleteSessionByHash(deps.db, tokenHash);
    throw unauthenticated();
  }

  // Sesi demo tidak pernah diperpanjang: berakhir tepat di demo_expires_at (SPEC §8.1).
  const isDemo = found.store.demoExpiresAt !== null;
  if (!isDemo && shouldRenew(found.session.expiresAt, now)) {
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    await renewSession(deps.db, found.session.id, expiresAt, now);
    c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_SECONDS));
  }

  return found;
}
