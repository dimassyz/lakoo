import { del, set } from "idb-keyval";
import type { SalesRecapPut, StockInBatchCreate } from "./api";

/**
 * FSD §0.4 — outbox di IndexedDB (bukan localStorage).
 * `id` sekaligus menjadi Idempotency-Key saat dikirim ulang.
 */
type Dasar = {
  id: string;
  tanggal: string;
  baris: number;
  status: "pending" | "needs_review";
  dibuat: string;
  /** Worker: percobaan gagal ke berapa, dan kapan boleh dicoba lagi (epoch ms). */
  coba?: number;
  berikut?: number;
};

export type OutboxItem =
  | (Dasar & { kind: "recap"; payload: SalesRecapPut })
  | (Dasar & { kind: "stockin"; payload: StockInBatchCreate });

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
