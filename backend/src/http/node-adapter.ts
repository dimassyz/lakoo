import type { IncomingMessage, ServerResponse } from "node:http";
import { payloadTooLarge } from "./errors.ts";

/** Batas body SPEC §8.2. Berlaku sebelum buffering supaya input besar tidak menghabiskan memori. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Header hop-by-hop / panjang yang dihitung ulang oleh Fetch Request. */
const SKIP_HEADERS = new Set([
  "content-length",
  "transfer-encoding",
  "connection",
]);

async function readCapped(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw payloadTooLarge();
    chunks.push(buffer);
  }
  // Kontrak hanya menerima JSON (SPEC §8.1), jadi body selalu teks.
  return Buffer.concat(chunks).toString("utf8");
}

function copyHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || SKIP_HEADERS.has(key)) continue;
    if (Array.isArray(value))
      value.forEach((item) => headers.append(key, item));
    else headers.set(key, value);
  }
  return headers;
}

/** Node `IncomingMessage` (Pages Router) → Fetch `Request` untuk Hono. */
export async function toFetchRequest(req: IncomingMessage): Promise<Request> {
  const method = req.method ?? "GET";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readCapped(req) : undefined;
  return new Request(url, { method, headers: copyHeaders(req), body });
}

/** Fetch `Response` → Node `ServerResponse`. */
export async function writeFetchResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") res.setHeader(key, value);
  });
  // Lebih dari satu Set-Cookie (mis. sesi + hapus cookie lama) akan digabung
  // jadi satu header oleh forEach, jadi diambil terpisah.
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}
