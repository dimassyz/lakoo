import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  createAccount,
  createSession,
  deleteSessionByHash,
  findStoreByOwner,
  findUserByEmail,
} from "../../repo/auth.ts";
import { emailTaken, invalidCredentials } from "../errors.ts";
import { hashPassword, verifyPassword } from "../password.ts";
import { LOGIN_RULE, REGISTER_RULE, consumeRateLimit } from "../rate-limit.ts";
import { toMe } from "../serialize.ts";
import {
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  generateToken,
  hashToken,
  readSessionToken,
  sessionCookie,
} from "../session.ts";
import { clientIp, readJson } from "../validate.ts";

export interface AuthDeps {
  db: AnyDb;
  now: () => Date;
}

const registerSchema = z
  .object({
    storeName: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(72),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

let dummyDigest: string | undefined;

/**
 * Saat email tidak terdaftar, tetap jalankan satu verifikasi argon2 supaya
 * waktu respons tidak membocorkan email mana yang ada (user enumeration).
 */
async function equalizeTiming(plain: string): Promise<void> {
  dummyDigest ??= await hashPassword("lakoo-timing-equalizer");
  await verifyPassword(dummyDigest, plain);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function startSession(deps: AuthDeps, userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(deps.now().getTime() + SESSION_TTL_SECONDS * 1000);
  await createSession(deps.db, userId, hashToken(token), expiresAt);
  return token;
}

async function handleRegister(c: Context, deps: AuthDeps) {
  // Rate limit per IP lebih dulu, sebelum parsing: percobaan beruntun tetap dibatasi.
  await consumeRateLimit(deps.db, REGISTER_RULE, clientIp(c), deps.now());
  const body = await readJson(c, registerSchema);
  const email = body.email.toLowerCase();

  if ((await findUserByEmail(deps.db, email)) !== undefined) throw emailTaken();

  const passwordHash = await hashPassword(body.password);
  let account;
  try {
    account = await createAccount(deps.db, {
      email,
      passwordHash,
      storeName: body.storeName,
    });
  } catch (error) {
    // Dua pendaftaran bersamaan: indeks unik yang menang, bukan cek di atas.
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }

  const token = await startSession(deps, account.user.id);
  c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_SECONDS));
  return c.json(toMe(account.user, account.store), 201);
}

async function handleLogin(c: Context, deps: AuthDeps) {
  const body = await readJson(c, loginSchema);
  const email = body.email.toLowerCase();
  await consumeRateLimit(
    deps.db,
    LOGIN_RULE,
    `${clientIp(c)}:${email}`,
    deps.now(),
  );

  const user = await findUserByEmail(deps.db, email);
  if (user?.passwordHash === null || user === undefined) {
    await equalizeTiming(body.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(user.passwordHash, body.password)))
    throw invalidCredentials();

  const store = await findStoreByOwner(deps.db, user.id);
  if (store === undefined) throw invalidCredentials();

  const token = await startSession(deps, user.id);
  c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_SECONDS));
  return c.json(toMe(user, store));
}

/** Idempoten: tanpa sesi pun tetap 204 dan cookie dikosongkan. */
async function handleLogout(c: Context, deps: AuthDeps) {
  const token = readSessionToken(c.req.header("cookie"));
  if (token !== undefined) await deleteSessionByHash(deps.db, hashToken(token));
  c.header("Set-Cookie", clearedSessionCookie());
  return c.body(null, 204);
}

export function authRoutes(deps: AuthDeps) {
  const app = new Hono();
  app.post("/register", (c) => handleRegister(c, deps));
  app.post("/login", (c) => handleLogin(c, deps));
  app.post("/logout", (c) => handleLogout(c, deps));
  return app;
}
