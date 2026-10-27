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
    fields[key] ??= fieldMessage(issue);
  }
  throw validationError(fields);
}

/** Bentuk pesan DEFAULT Zod v3 yang masih berbahasa Inggris. Kalau pesan tidak
 *  cocok pola ini, itu pesan kustom dari skema (mis. "tanggal harus format
 *  YYYY-MM-DD") dan dipertahankan apa adanya. */
const ZOD_DEFAULT_EN =
  /^(String|Array|Number|Set|Date) must |^Expected .+, received |^Invalid |^Unrecognized key/;

/** Pesan Indonesia untuk kode Zod yang tidak butuh parameter. */
const FLAT: Partial<Record<z.ZodIssue["code"], string>> = {
  invalid_enum_value: "Nilai tidak valid.",
  unrecognized_keys: "Ada field yang tidak dikenal.",
  invalid_date: "Tanggal tidak valid.",
  not_multiple_of: "Nilai tidak sesuai kelipatan.",
};

/** `invalid_string.validation` → pesan Indonesia. */
const STRING_RULE: Partial<Record<string, string>> = {
  email: "Format email tidak valid.",
  uuid: "Format UUID tidak valid.",
  url: "Format tautan tidak valid.",
};

/** `too_small`/`too_big` butuh batas + satuan, jadi dihitung terpisah. */
function sizeMessage(issue: z.ZodIssue): string | undefined {
  if (issue.code !== "too_small" && issue.code !== "too_big") return undefined;
  const n = issue.code === "too_small" ? issue.minimum : issue.maximum;
  const dir = issue.code === "too_small" ? "minimal" : "maksimal";
  if (issue.type === "array" || issue.type === "set")
    return `${dir} ${n} baris`;
  if (issue.type === "number" || issue.type === "bigint")
    return `harus ${dir} ${n}`;
  return `${dir} ${n} karakter`;
}

/**
 * Kontrak (`openapi.yaml`, Error.message) mensyaratkan pesan berbahasa Indonesia
 * yang aman ditampilkan ke pengguna. Pesan default Zod berbahasa Inggris, jadi
 * dipetakan di sini — satu tempat untuk semua skema dan semua pemanggil.
 */
export function fieldMessage(issue: z.ZodIssue): string {
  if (!ZOD_DEFAULT_EN.test(issue.message)) return issue.message;
  if (issue.code === "invalid_type")
    return `Format tidak sesuai (diharapkan ${issue.expected}).`;
  if (issue.code === "invalid_string") {
    // `validation` bisa berupa object (startsWith/endsWith/includes), bukan cuma string.
    return typeof issue.validation === "string"
      ? (STRING_RULE[issue.validation] ?? "Format tidak valid.")
      : "Format tidak valid.";
  }
  return sizeMessage(issue) ?? FLAT[issue.code] ?? "Isian tidak valid.";
}

/** Alamat klien untuk rate limit. Bukan untuk otorisasi. */
export function clientIp(c: Context): string {
  // Vercel menimpa x-forwarded-for, jadi entri pertama adalah klien asli.
  // ponytail: di luar Vercel header ini bisa dipalsukan; jangan pakai untuk authz.
  const forwarded = c.req.header("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first === undefined || first === "" ? "unknown" : first;
}
