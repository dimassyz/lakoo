import { createHash, randomBytes } from "node:crypto";

/** Nama cookie kontrak (openapi.yaml components/securitySchemes/sessionCookie). */
export const SESSION_COOKIE = "lakoo_session";

/** SPEC §8.1: sesi biasa 30 hari, sesi demo berakhir pada `demo_expires_at`. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEMO_TTL_SECONDS = 24 * 60 * 60;

/** Perpanjang bila sisa masa berlaku < 15 hari (SPEC §8.1). */
export const RENEW_BEFORE_SECONDS = 15 * 24 * 60 * 60;

/** Token acak 32 byte, base64url (SPEC §8.1). Hanya nilai ini yang dikirim ke klien. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Yang disimpan di DB hanya SHA-256 token (SPEC §8.1). Tanpa ini, bocornya
 * tabel `sessions` langsung berarti bocornya sesi semua pengguna.
 */
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Baca nilai cookie sesi dari header `Cookie`. */
export function readSessionToken(
  cookieHeader: string | undefined,
): string | undefined {
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    return value === "" ? undefined : value;
  }
  return undefined;
}

function cookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export const sessionCookie = (token: string, maxAge: number): string =>
  cookie(token, maxAge);

/** Logout: kosongkan cookie dengan atribut yang sama seperti saat diset. */
export const clearedSessionCookie = (): string => cookie("", 0);

/** True bila sesi perlu diperpanjang karena sisanya tinggal < 15 hari. */
export function shouldRenew(expiresAt: Date, now: Date): boolean {
  const remainingSeconds = (expiresAt.getTime() - now.getTime()) / 1000;
  return remainingSeconds < RENEW_BEFORE_SECONDS;
}
