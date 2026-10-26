import Link from "next/link";
import type { Dashboard, ProductStatus } from "@/lib/api";
import { rupiah } from "@/lib/ui";

/** FSD §6 blok 1 — "Uang terkunci di rak". */
export function KpiHero({ totals }: { totals: Dashboard["totals"] }) {
  return (
    <section
      aria-labelledby="hero-label"
      className="rounded-card border-muted border p-4"
    >
      <h1 id="hero-label" className="text-muted text-[15px]">
        Uang terkunci di rak
      </h1>
      <p className="mt-1 text-4xl font-bold tracking-tight">
        {rupiah(totals.lockedValue)}
      </p>
      <p className="text-muted mt-1 text-[15px]">
        {rupiah(totals.problemLockedValue)} di barang bermasalah
      </p>
      {totals.complementaryLockedValue > 0 ? (
        <p className="text-muted text-[15px]">
          termasuk {rupiah(totals.complementaryLockedValue)} di barang pelengkap
        </p>
      ) : null}
    </section>
  );
}

type Ubin = { status: ProductStatus; label: string; ikon: string };

const ubin: Ubin[] = [
  { status: "sehat", label: "Sehat", ikon: "✓" },
  { status: "waspada", label: "Waspada", ikon: "⚠" },
  { status: "sekarat", label: "Sekarat", ikon: "⏳" },
  { status: "mati", label: "Mati", ikon: "⊗" },
];

function SatuUbin({
  item,
  bucket,
}: {
  item: Ubin;
  bucket: Dashboard["totals"]["byStatus"][ProductStatus];
}) {
  return (
    <Link
      href={`/barang?status=${item.status}`}
      className="rounded-card border-muted border p-3"
      aria-label={`${item.label}: ${bucket.count} barang, ${rupiah(bucket.lockedValue)} terkunci`}
    >
      <span className="text-muted text-[15px]">
        <span aria-hidden="true">{item.ikon}</span> {item.label}
      </span>
      <span
        className={`mt-1 block text-2xl font-bold ${item.status === "sehat" ? "text-safe" : "text-ink"}`}
      >
        {bucket.count}
      </span>
      <span className="text-muted block text-[15px]">
        {rupiah(bucket.lockedValue)}
      </span>
    </Link>
  );
}

/** FSD §6 blok 2 — 4 ubin status, 2×2 di HP dan 4 kolom di desktop. */
export function StatusTiles({
  byStatus,
}: {
  byStatus: Dashboard["totals"]["byStatus"];
}) {
  const habis = byStatus.stok_habis;

  return (
    <section aria-label="Status barang">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ubin.map((item) => (
          <SatuUbin
            key={item.status}
            item={item}
            bucket={byStatus[item.status]}
          />
        ))}
      </div>
      {habis.count > 0 ? (
        <p className="text-muted mt-2 text-[15px]">
          {habis.count} barang stok habis
        </p>
      ) : null}
    </section>
  );
}
