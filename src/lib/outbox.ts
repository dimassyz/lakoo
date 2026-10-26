import { del, set } from "idb-keyval";
import type { SalesRecapPut } from "./api";

/**
 * FSD §0.4 — outbox di IndexedDB (bukan localStorage).
 * `id` sekaligus menjadi Idempotency-Key saat dikirim ulang.
 */
export type OutboxItem = {
  id: string;
  kind: "recap";
  tanggal: string;
  baris: number;
  status: "pending" | "needs_review";
  payload: SalesRecapPut;
  dibuat: string;
};

const kunci = (id: string) => `outbox:${id}`;

/** UUID v4 dari platform, tanpa dependensi. */
export function idOutbox(): string {
  return crypto.randomUUID();
}

/** Disimpan SEBELUM request dikirim, supaya isian tidak hilang bila sinyal putus. */
export async function simpanOutbox(item: OutboxItem): Promise<void> {
  await set(kunci(item.id), item);
}

/** Hanya dipanggil setelah server menjawab 2xx. */
export async function hapusOutbox(id: string): Promise<void> {
  await del(kunci(id));
}
