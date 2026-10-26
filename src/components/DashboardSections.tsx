import Link from "next/link";
import type { Dashboard } from "@/lib/api";
import { labelStatus, rupiah } from "@/lib/ui";

type D = Dashboard;

/** FSD §6 blok 3 — "Hari ini", maksimal 5 baris. */
export function HariIni({ today }: { today: D["today"] }) {
  const baris = [
    ...today.dueSteps.map((s) => ({
      key: `step-${s.planId}-${s.stepNo}`,
      teks: `Tahap ${s.stepNo} ${s.title} untuk ${s.productName} sudah waktunya dicek`,
      href: `/barang/${s.productId}#rencana`,
    })),
    ...today.statusChanges.map((c) => ({
      key: `change-${c.productId}-${c.to}`,
      teks: `${c.name}: ${labelStatus(c.from)} → ${labelStatus(c.to)}`,
      href: `/barang/${c.productId}`,
    })),
  ];

  return (
    <section aria-labelledby="hari-ini">
      <h2 id="hari-ini" className="text-muted mb-2 text-[15px] font-semibold">
        Hari ini
      </h2>
      {baris.length === 0 ? (
        <p className="text-[15px]">Tidak ada yang perlu dicek hari ini</p>
      ) : (
        <ul className="space-y-1">
          {baris.slice(0, 5).map((b) => (
            <li key={b.key} className="text-[15px]">
              <Link
                href={b.href}
                className="decoration-muted underline underline-offset-2"
              >
                {b.teks}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {baris.length > 5 ? (
        <Link
          href="/rencana"
          className="text-muted mt-1 block text-[15px] underline"
        >
          lihat semua
        </Link>
      ) : null}
    </section>
  );
}

/** FSD §6 blok 4 — hanya tampil bila weeklySummary ada. */
export function RingkasanMinggu({ summary }: { summary: D["weeklySummary"] }) {
  if (!summary) return null;

  return (
    <section
      aria-labelledby="ringkasan-minggu"
      className="rounded-card border-muted border p-4"
    >
      <h2
        id="ringkasan-minggu"
        className="text-muted mb-2 text-[15px] font-semibold"
      >
        Minggu lalu
      </h2>
      {summary.sentences.map((s) => (
        <p key={s} className="text-[15px]">
          {s}
        </p>
      ))}
      <Link href="/hasil" className="mt-2 inline-block text-[15px] underline">
        Lihat hasil
      </Link>
    </section>
  );
}

/** FSD §6 blok 5 — "Tangani dulu", maksimal 3 barang. */
export function TanganiDulu({ items }: { items: D["topPriority"] }) {
  return (
    <section aria-labelledby="tangani-dulu">
      <h2
        id="tangani-dulu"
        className="text-muted mb-2 text-[15px] font-semibold"
      >
        Tangani dulu
      </h2>
      {items.length === 0 ? (
        <p className="text-[15px]">Tidak ada barang bermasalah. Mantap!</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 3).map((p) => (
            <li key={p.id} className="rounded-card border-muted border p-3">
              <p className="font-semibold">{p.name}</p>
              <p className="text-muted text-[15px]">
                {labelStatus(p.status)} · {rupiah(p.lockedValue)} terkunci
              </p>
              {p.reason ? <p className="text-[15px]">{p.reason}</p> : null}
              <Link
                href={`/barang/${p.id}#rencana`}
                className="rounded-card border-safe text-safe mt-2 inline-block border px-3 py-2 text-[15px] font-semibold"
              >
                Lihat rencana
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** FSD §6 blok 6 — "Segera kulakan", maksimal 10. */
export function SegeraKulakan({ items }: { items: D["restockSoon"] }) {
  const siap = items.filter((p) => p.daysUntilEmpty !== null).slice(0, 10);
  if (siap.length === 0) return null;

  return (
    <section aria-labelledby="kulakan">
      <h2 id="kulakan" className="text-muted mb-2 text-[15px] font-semibold">
        Segera kulakan
      </h2>
      <ul className="space-y-1">
        {siap.map((p) => (
          <li key={p.id} className="text-[15px]">
            {p.name} — ±{p.daysUntilEmpty} hari lagi habis
          </li>
        ))}
      </ul>
    </section>
  );
}

/** FSD §6 blok 7 — "Pelengkap kebanyakan". */
export function PelengkapKebanyakan({
  items,
}: {
  items: D["complementaryOverstock"];
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="pelengkap">
      <h2 id="pelengkap" className="text-muted mb-2 text-[15px] font-semibold">
        Pelengkap kebanyakan
      </h2>
      <ul className="space-y-1">
        {items.map((p) => (
          <li key={p.id} className="text-[15px]">
            {p.name}: stok {p.stock}, jangan kulakan dulu sampai tinggal{" "}
            {p.complementaryThreshold}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** FSD §6 state kosong — toko baru tanpa barang. */
export function BerandaKosong() {
  return (
    <section className="rounded-card border-muted border p-4">
      <p className="font-semibold">Belum ada barang</p>
      <p className="text-muted mt-1 text-[15px]">
        Mulai dengan menambah satu barang atau import daftar yang sudah kamu
        punya.
      </p>
      <div className="mt-3 flex gap-2">
        <Link
          href="/barang/baru"
          className="rounded-card bg-safe px-4 py-3 font-semibold text-white"
        >
          Tambah barang
        </Link>
        <Link
          href="/import"
          className="rounded-card border-muted border px-4 py-3 font-semibold"
        >
          Import dari file
        </Link>
      </div>
    </section>
  );
}

/** Dipakai Beranda untuk memilih state kosong. */
export function tanpaBarang(totals: D["totals"]): boolean {
  return Object.values(totals.byStatus).every((b) => b.count === 0);
}
