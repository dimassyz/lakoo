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

/**
 * FSD §6 blok 1 — "Uang terkunci di rak". DESIGN-V3 §9 R-HERO: kartu PUTIH,
 * angka tinta (navy) 34/40/48px, subbaris merah tenang (token chip Mati).
 * Blok navy penuh ditinggalkan — board v2-02 yang menang.
 */
export function KpiHero({ totals }: { totals: Dashboard["totals"] }) {
  return (
    <section
      aria-labelledby="hero-label"
      className="rounded-card border-garis bg-card shadow-card border p-6"
    >
      <h1 id="hero-label" className="text-slate text-sm font-semibold">
        Uang terkunci di rak
      </h1>
      <p className="angka text-navy mt-2 text-[34px] leading-[1.1] font-extrabold tracking-[-0.02em] md:text-[40px] lg:text-[48px]">
        {rupiah(totals.lockedValue)}
      </p>
      <p className="angka text-mati-chip mt-2 text-base font-semibold">
        {rupiah(totals.problemLockedValue)} di barang bermasalah
      </p>
      {totals.complementaryLockedValue > 0 ? (
        <p className="angka text-muted mt-1 text-sm">
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
      className="rounded-card border-garis bg-card shadow-card border px-6 py-5"
      aria-label={`${item.label}: ${bucket.count} barang, ${rupiah(bucket.lockedValue)} terkunci`}
    >
      <span className="text-muted flex items-center gap-2 text-sm font-semibold">
        <item.ikon
          size={20}
          strokeWidth={1.75}
          aria-hidden="true"
          className={item.warna}
        />
        {item.label}
      </span>
      <span className="angka text-navy mt-3 block text-[32px] leading-[1.15] font-extrabold">
        {bucket.count}
      </span>
      <span className="text-slate angka mt-1 block text-sm">
        {rupiah(bucket.lockedValue)}
      </span>
    </Link>
  );
}

/**
 * FSD §6 blok 2 — 4 ubin status. DESIGN-V3 §5: 2×2 di HP, 2 kolom di samping
 * hero pada md (grid halaman yang mengatur), 4 sebaris pada lg.
 */
export function StatusTiles({
  byStatus,
}: {
  byStatus: Dashboard["totals"]["byStatus"];
}) {
  const habis = byStatus.stok_habis;

  return (
    <section aria-label="Status barang">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ubin.map((item) => (
          <SatuUbin
            key={item.status}
            item={item}
            bucket={byStatus[item.status]}
          />
        ))}
      </div>
      {habis.count > 0 ? (
        <p className="text-muted mt-3 flex items-center gap-2 text-[13px]">
          <PackageX size={20} strokeWidth={1.75} aria-hidden="true" />
          {habis.count} barang stok habis
        </p>
      ) : null}
    </section>
  );
}
