import Link from "next/link";
import type { Dashboard } from "@/lib/api";
import { tautanTeks, tombolHantu, tombolUtama } from "@/lib/tombol";
import { labelStatus as labelStatusTeks, rupiah } from "@/lib/ui";
import { ChipStatus, kelasTeksStatus } from "@/components/ChipStatus";

type D = Dashboard;

/** FSD §6 blok 3 — "Hari ini", maksimal 5 baris. */
export function HariIni({ today }: { today: D["today"] }) {
  const baris = [
    ...today.dueSteps.map((s) => ({
      key: `step-${s.planId}-${s.stepNo}`,
      teks: (
        <>
          Tahap {s.stepNo} {s.title} untuk {s.productName} sudah waktunya dicek
        </>
      ),
      href: `/toko/barang/${s.productId}#rencana`,
    })),
    ...today.statusChanges.map((c) => ({
      key: `change-${c.productId}-${c.to}`,
      teks: (
        <>
          {c.name}: {labelStatusTeks(c.from)} →{" "}
          <span className={`font-semibold ${kelasTeksStatus[c.to]}`}>
            {labelStatusTeks(c.to)}
          </span>
        </>
      ),
      href: `/toko/barang/${c.productId}`,
    })),
  ];

  return (
    <section aria-labelledby="hari-ini">
      <h2 id="hari-ini" className="mb-4 text-xl font-extrabold">
        Hari ini
      </h2>
      {baris.length === 0 ? (
        <div className="rounded-card border-garis bg-card shadow-card border p-6">
          <p className="text-base">Tidak ada yang perlu dicek hari ini</p>
        </div>
      ) : (
        <ul className="rounded-card border-garis bg-card shadow-card space-y-1 border p-6">
          {baris.slice(0, 5).map((b) => (
            <li key={b.key} className="text-sm">
              <Link
                href={b.href}
                className={`${tautanTeks} decoration-muted underline-offset-2`}
              >
                {b.teks}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {baris.length > 5 ? (
        <Link
          href="/toko/rencana"
          className={`${tautanTeks} text-muted mt-1 block text-base`}
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
      className="rounded-card border-garis bg-pasir shadow-card border p-6"
    >
      <h2 id="ringkasan-minggu" className="mb-3 text-base font-bold">
        Minggu lalu
      </h2>
      {summary.sentences.map((s) => (
        <p key={s} className="mt-2 text-sm first-of-type:mt-0">
          {s}
        </p>
      ))}
      <Link
        href="/toko/hasil"
        className={`${tautanTeks} text-navy mt-3 inline-block text-sm font-semibold underline-offset-[3px]`}
      >
        Lihat hasil
      </Link>
    </section>
  );
}

/** FSD §6 blok 5 — "Tangani dulu", maksimal 3 barang. */
export function TanganiDulu({ items }: { items: D["topPriority"] }) {
  return (
    <section aria-labelledby="tangani-dulu">
      <h2 id="tangani-dulu" className="mb-4 text-xl font-extrabold">
        Tangani dulu
      </h2>
      {items.length === 0 ? (
        <div className="rounded-card border-garis bg-card shadow-card border p-6">
          <p className="text-base">Tidak ada barang bermasalah. Mantap!</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.slice(0, 3).map((p) => (
            <li
              key={p.id}
              className="rounded-card border-garis bg-card shadow-card border px-6 py-5"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-navy font-bold">{p.name}</p>
                <ChipStatus status={p.status} />
              </div>
              <p className="text-slate mt-2 text-sm">
                <span className="angka">{rupiah(p.lockedValue)}</span> terkunci
                {typeof p.daysSinceLastSale === "number" ? (
                  <>
                    {" "}
                    · <span className="angka">{p.daysSinceLastSale}</span> hari
                    tidak laku
                  </>
                ) : null}
              </p>
              <Link
                href={`/toko/barang/${p.id}#rencana`}
                className={`${tombolUtama} rounded-btn mt-4 inline-flex min-h-11 items-center px-4 text-sm`}
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
    <section
      aria-labelledby="kulakan"
      className="rounded-card border-garis bg-pasir shadow-card border p-6"
    >
      <h2 id="kulakan" className="mb-3 text-base font-bold">
        Segera kulakan
      </h2>
      <ul className="divide-garis divide-y">
        {siap.map((p) => (
          <li
            key={p.id}
            className="flex items-baseline justify-between gap-4 py-2.5"
          >
            <span className="text-navy text-sm font-semibold">{p.name}</span>
            {p.daysUntilEmpty === 0 ? (
              <span className="text-mati-chip text-[13px] font-semibold whitespace-nowrap">
                Stok habis
              </span>
            ) : (
              <span className="text-muted text-[13px] font-semibold whitespace-nowrap">
                ±{p.daysUntilEmpty} hari lagi habis
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="/toko/barang"
        className={`${tautanTeks} text-navy mt-3 inline-block text-sm font-semibold underline-offset-[3px]`}
      >
        Lihat semua barang
      </Link>
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
    <section
      aria-labelledby="pelengkap"
      className="rounded-card border-garis bg-pasir shadow-card border p-6"
    >
      <h2 id="pelengkap" className="mb-3 text-base font-bold">
        Pelengkap kebanyakan
      </h2>
      <ul className="divide-garis divide-y">
        {items.map((p) => (
          <li key={p.id} className="py-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-navy text-sm font-semibold">{p.name}</span>
              <span className="text-muted text-[13px] font-semibold whitespace-nowrap">
                stok {p.stock}
              </span>
            </div>
            <p className="text-muted mt-0.5 text-sm">
              Jangan kulakan dulu sampai tinggal {p.complementaryThreshold}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** FSD §6 state kosong — toko baru tanpa barang. */
export function BerandaKosong() {
  return (
    <section className="rounded-card border-garis bg-card shadow-card border p-6">
      <p className="text-navy font-semibold">Belum ada barang</p>
      <p className="text-muted mt-1 text-base">
        Mulai dengan menambah satu barang atau import daftar yang sudah kamu
        punya.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/toko/barang/baru"
          className={`${tombolUtama} rounded-btn inline-flex min-h-11 items-center px-4`}
        >
          Tambah barang
        </Link>
        <Link
          href="/toko/import"
          className={`${tombolHantu} rounded-btn inline-flex min-h-11 items-center px-4`}
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
