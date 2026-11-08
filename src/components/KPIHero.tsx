import { PackageX } from "lucide-react";
import Link from "next/link";
import type { Dashboard, ProductStatus } from "@/lib/api";
import { dasarInteraktif } from "@/lib/tombol";
import { rupiah } from "@/lib/ui";
import { ChipStatus, kelasTeksStatus } from "@/components/ChipStatus";

/**
 * FSD §6 blok 1 — "Uang terkunci di rak". PALETTE-V6 varian A (menggantikan
 * R-HERO v3): permukaan EMERALD-GELAP, label marigold 700, angka PUTIH
 * 34/40/48px, band masalah putih 10% (dot merah-terang, teks band-terang),
 * catatan note-gelap. Kontras terhitung di PALETTE-V6 (semua ≥4,5:1).
 */
export function KpiHero({ totals }: { totals: Dashboard["totals"] }) {
  return (
    <section
      aria-labelledby="hero-label"
      className="rounded-card bg-emerald-gelap shadow-card p-6"
    >
      <h1 id="hero-label" className="text-marigold text-sm font-bold">
        Uang terkunci di rak
      </h1>
      <p className="angka mt-2 text-[34px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white md:text-[40px] lg:text-[48px]">
        {rupiah(totals.lockedValue)}
      </p>
      <p className="rounded-btn mt-3 flex items-center gap-2 bg-white/10 px-4 py-3">
        <span
          aria-hidden="true"
          className="bg-merah-terang h-2 w-2 shrink-0 rounded-full"
        />
        <span className="angka text-band-terang text-base font-semibold">
          {rupiah(totals.problemLockedValue)} di barang bermasalah
        </span>
      </p>
      {totals.complementaryLockedValue > 0 ? (
        <p className="angka text-note-gelap mt-3 text-sm">
          termasuk {rupiah(totals.complementaryLockedValue)} di barang pelengkap
        </p>
      ) : null}
    </section>
  );
}

type StatusUbin = Exclude<ProductStatus, "stok_habis">;

type Ubin = {
  status: StatusUbin;
  label: string;
};

/**
 * PALETTE-V6 — ubin status: permukaan tint ubin hue status di atas paper,
 * chip varian "ubin" (latar putih), angka berwarna teks status (token CHIP
 * dipergelap, 4,6:1 di atas tint), jumlah slate. Status tidak pernah
 * dibedakan warna saja — label teks selalu tampil. Ubin adalah TAUTAN:
 * hover mengangkat bayangan + border marigold-kuat (affordance v6).
 */
const kelasUbin: Record<Ubin["status"], string> = {
  sehat: "bg-sehat-ubin",
  waspada: "bg-waspada-ubin",
  sekarat: "bg-sekarat-ubin",
  mati: "bg-mati-ubin",
};

const ubin: Ubin[] = [
  { status: "sehat", label: "Sehat" },
  { status: "waspada", label: "Waspada" },
  { status: "sekarat", label: "Sekarat" },
  { status: "mati", label: "Mati" },
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
      className={`${dasarInteraktif} rounded-card border-garis shadow-card hover:border-marigold-kuat hover:shadow-float block border px-6 py-5 ${kelasUbin[item.status]}`}
      aria-label={`${item.label}: ${bucket.count} barang, ${rupiah(bucket.lockedValue)} terkunci`}
    >
      <ChipStatus status={item.status} variant="ubin" />
      <span
        className={`angka mt-3 block text-[32px] leading-[1.15] font-extrabold ${kelasTeksStatus[item.status]}`}
      >
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
          <PackageX size={16} strokeWidth={1.75} aria-hidden="true" />
          {habis.count} barang stok habis
        </p>
      ) : null}
    </section>
  );
}
