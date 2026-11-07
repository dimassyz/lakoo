import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  PackageX,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Dashboard, ProductStatus } from "@/lib/api";
import { rupiah } from "@/lib/ui";

/** FSD §6 blok 1 — "Uang terkunci di rak". DESIGN.md §4 RHYTHM: hero satu blok navy + satu angka besar. */
export function KpiHero({ totals }: { totals: Dashboard["totals"] }) {
  return (
    <section aria-labelledby="hero-label" className="rounded-card bg-navy p-4">
      <h1 id="hero-label" className="text-surface/70 text-[15px]">
        Uang terkunci di rak
      </h1>
      <p className="angka text-surface mt-1 text-4xl font-extrabold tracking-tight">
        {rupiah(totals.lockedValue)}
      </p>
      <p className="text-surface/70 mt-1 text-[15px]">
        {rupiah(totals.problemLockedValue)} di barang bermasalah
      </p>
      {totals.complementaryLockedValue > 0 ? (
        <p className="text-surface/70 text-[15px]">
          termasuk {rupiah(totals.complementaryLockedValue)} di barang pelengkap
        </p>
      ) : null}
    </section>
  );
}

type Ubin = {
  status: ProductStatus;
  label: string;
  ikon: LucideIcon;
  warna: string;
};

/**
 * Kelas warna ditulis literal di sini, BUKAN disusun dari `item.status`:
 * Tailwind v4 memindai sumber untuk string kelas, jadi `text-${status}-chip`
 * tidak pernah jadi utility. Nol hex di berkas ini — semuanya lewat tokens.css.
 * Token CHIP (bukan dasar) untuk angka ubin: latar kartu adalah
 * `--color-surface`, dan token dasar Waspada hanya 2,97:1 di sana — gagal 3:1.
 * Chip 4,68:1 lolos. Lihat komentar tokens.css §2 untuk angka lengkap.
 * Ikon Lucide 20px / stroke 1.75px (DESIGN.md §3) — emoji render beda per OS
 * dan merusak ramp status.
 */
const ubin: Ubin[] = [
  {
    status: "sehat",
    label: "Sehat",
    ikon: CircleCheck,
    warna: "text-sehat-chip",
  },
  {
    status: "waspada",
    label: "Waspada",
    ikon: AlertTriangle,
    warna: "text-waspada-chip",
  },
  {
    status: "sekarat",
    label: "Sekarat",
    ikon: TrendingDown,
    warna: "text-sekarat-chip",
  },
  { status: "mati", label: "Mati", ikon: CircleX, warna: "text-mati-chip" },
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
      href={`/toko/barang?status=${item.status}`}
      className="rounded-card border-muted border p-3"
      aria-label={`${item.label}: ${bucket.count} barang, ${rupiah(bucket.lockedValue)} terkunci`}
    >
      <span className="text-muted flex items-center gap-2 text-[15px]">
        <item.ikon
          size={20}
          strokeWidth={1.75}
          aria-hidden="true"
          className={item.warna}
        />
        {item.label}
      </span>
      <span className={`mt-1 block text-2xl font-bold ${item.warna}`}>
        {bucket.count}
      </span>
      <span className="text-muted angka block text-[15px]">
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
        <p className="text-muted mt-2 flex items-center gap-2 text-[15px]">
          <PackageX size={20} strokeWidth={1.75} aria-hidden="true" />
          {habis.count} barang stok habis
        </p>
      ) : null}
    </section>
  );
}
