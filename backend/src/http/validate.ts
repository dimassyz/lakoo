import type { Context } from "hono";
import type { z } from "zod";
import { validationError } from "./errors.ts";

/**
 * Baca body JSON dan validasi dengan Zod. Field tak dikenal ditolak karena
 * semua skema memakai `.strict()` (SPEC §8.2).
 */
export async function readJson<T>(
  c: Context,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw validationError({ _: "Body harus JSON yang valid." });
  }

  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  throw validationError(fields);
}

/** Alamat klien untuk rate limit. Bukan untuk otorisasi. */
export function clientIp(c: Context): string {
  // Vercel menimpa x-forwarded-for, jadi entri pertama adalah klien asli.
  // ponytail: di luar Vercel header ini bisa dipalsukan; jangan pakai untuk authz.
  const forwarded = c.req.header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first === undefined || first === "" ? "unknown" : first;
}
