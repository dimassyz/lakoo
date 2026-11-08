import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/NavBar";
import type { ProductSummary } from "@/lib/api";
import {
  CHIP,
  KOLOM,
  filterDariQuery,
  keterangan,
  urutkan,
  useDaftarBarang,
  type Filter,
  type Kolom,
} from "@/lib/barang";
import { rupiah, tanggalPendek } from "@/lib/ui";
import { ChipStatus } from "@/components/ChipStatus";

const tombolGaris =
  "rounded-btn border-line inline-flex min-h-11 cursor-pointer items-center border px-4 font-semibold transition duration-150 hover:border-slate hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";

/* Kelas CTA utama v6 — marigold solid, teks ink, hover lebih gelap
   (PALETTE-V6: .btn-primary). Dipakai tautan Tambah + tombol Coba lagi. */
const tombolUtama =
  "rounded-btn inline-flex min-h-11 cursor-pointer items-center bg-[#E8A33D] px-4 font-semibold text-navy transition duration-150 hover:bg-[#D9932B] focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";

function gayaChip(aktif: boolean) {
  /* Palet v6 (PALETTE-V6 + mock.css .pill) — pill penuh, target sentuh 44px;
     aktif solid marigold teks ink, nonaktif putih hover border slate. */
  const dasar =
    "rounded-pill inline-flex min-h-11 cursor-pointer items-center border px-4 text-[13px] font-semibold whitespace-nowrap transition duration-150 focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";
  return `${dasar} ${aktif ? "border-[#E8A33D] bg-[#E8A33D] text-navy" : "border-line bg-card text-slate hover:border-slate hover:text-navy"}`;
}

/** FSD §9 — chip status + toggle arsip. */
function ChipFilter({
  filter,
  arsip,
  onFilter,
  onArsip,
}: {
  filter: Filter;
  arsip: boolean;
  onFilter: (f: Filter) => void;
  onArsip: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {CHIP.map((c) => (
          <button
            key={c.kunci}
            type="button"
            aria-pressed={filter === c.kunci}
            onClick={() => onFilter(c.kunci)}
            className={gayaChip(filter === c.kunci)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base">
        <input
          type="checkbox"
          checked={arsip}
          onChange={(e) => onArsip(e.target.checked)}
          className="cursor-pointer"
        />
        Tampilkan arsip
      </label>
    </div>
  );
}

/** FSD §9 — baris HP: nama, status, stok, uang terkunci, keterangan kecil. */
function KartuBarang({ p }: { p: ProductSummary }) {
  const ket = keterangan(p);

  return (
    <li>
      <Link
        href={`/toko/barang/${p.id}`}
        className="md:rounded-card md:border-garis md:bg-card md:shadow-card focus-visible:outline-navy block cursor-pointer p-4 transition duration-150 hover:bg-[#F3EFE7] focus-visible:outline-2 focus-visible:outline-offset-2 md:border"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-navy font-semibold">{p.name}</p>
          <ChipStatus status={p.status} />
        </div>
        <p className="text-muted text-base">
          stok <span className="angka">{p.stock}</span> ·{" "}
          <span className="angka">{rupiah(p.lockedValue)}</span> terkunci
        </p>
        {ket ? <p className="text-muted text-[13px]">{ket}</p> : null}
      </Link>
    </li>
  );
}

function KepalaTabel({
  kolom,
  naik,
  onKlik,
}: {
  kolom: Kolom;
  naik: boolean;
  onKlik: (k: Kolom) => void;
}) {
  return (
    <thead>
      <tr className="border-garis border-b text-left">
        {KOLOM.map((c) => (
          <th
            key={c.kunci}
            scope="col"
            aria-sort={
              kolom === c.kunci ? (naik ? "ascending" : "descending") : "none"
            }
            className="px-2 py-3 text-[13px]"
          >
            <button
              type="button"
              onClick={() => onKlik(c.kunci)}
              className="hover:text-navy focus-visible:outline-navy cursor-pointer font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {c.label}
              {kolom === c.kunci ? (naik ? " ↑" : " ↓") : ""}
            </button>
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** FSD §9 — tabel desktop, kolom bisa diurutkan di sisi klien. */
function TabelBarang({ items }: { items: ProductSummary[] }) {
  const [kolom, setKolom] = useState<Kolom>("priorityScore");
  const [naik, setNaik] = useState(false);
  const baris = useMemo(
    () => urutkan(items, kolom, naik),
    [items, kolom, naik],
  );

  function klik(k: Kolom) {
    if (k === kolom) setNaik(!naik);
    else {
      setKolom(k);
      setNaik(true);
    }
  }

  /* DESIGN-V3 §5 — di lg daftar tampil sebagai baris mirip tabel di dalam
     kartu putih (header kolom dari KOLOM aplikasi, bukan versi board). */
  return (
    <div className="rounded-card border-garis bg-card shadow-card hidden border p-6 lg:block">
      <table className="w-full">
        <KepalaTabel kolom={kolom} naik={naik} onKlik={klik} />
        <tbody>
          {baris.map((p) => (
            <tr
              key={p.id}
              className="border-garis border-b transition-colors duration-150 last:border-b-0 hover:bg-[#F3EFE7]"
            >
              <td className="px-2 py-3">
                <Link
                  href={`/toko/barang/${p.id}`}
                  className="text-navy focus-visible:outline-navy cursor-pointer font-semibold hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {p.name}
                </Link>
              </td>
              <td className="px-2 py-3">
                <ChipStatus status={p.status} />
              </td>
              <td className="angka px-2 py-3">{p.stock}</td>
              <td className="angka px-2 py-3">{rupiah(p.lastCost)}</td>
              <td className="angka px-2 py-3">{rupiah(p.sellPrice)}</td>
              <td className="angka px-2 py-3">{rupiah(p.lockedValue)}</td>
              <td className="px-2 py-3">
                {p.lastSaleDate ? tanggalPendek(p.lastSaleDate) : "Belum"}
              </td>
              <td className="angka px-2 py-3">{p.priorityScore ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kosong({ adaFilter }: { adaFilter: boolean }) {
  if (adaFilter) {
    return (
      <p className="text-muted text-base">
        Tidak ada barang yang cocok dengan filter atau pencarian ini.
      </p>
    );
  }

  return (
    <div className="rounded-card border-garis bg-card shadow-card border p-6">
      <p className="text-navy font-semibold">Belum ada barang.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/toko/barang/baru" className={tombolUtama}>
          Tambah barang
        </Link>
        <Link href="/toko/import" className={tombolGaris}>
          Import dari file
        </Link>
      </div>
    </div>
  );
}

function IsiDaftar({
  memuat,
  gagal,
  items,
  adaFilter,
  onMuat,
}: {
  memuat: boolean;
  gagal: boolean;
  items: ProductSummary[];
  adaFilter: boolean;
  onMuat: () => void;
}) {
  if (memuat) return <p className="text-muted text-base">Memuat…</p>;

  if (gagal) {
    return (
      <div className="rounded-card border-garis bg-card border p-4">
        <p className="text-navy font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={onMuat}
          className={`${tombolUtama} mt-4`}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (items.length === 0) return <Kosong adaFilter={adaFilter} />;

  return (
    <>
      {/* DESIGN-V3 §5 — HP: satu kartu putih berisi semua baris dengan
          garis pemisah hairline; md: kartu dua kolom; lg: tabel (di bawah). */}
      <ul className="rounded-card border-garis bg-card shadow-card divide-garis grid divide-y border md:grid-cols-2 md:gap-4 md:divide-y-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none lg:hidden">
        {items.map((p) => (
          <KartuBarang key={p.id} p={p} />
        ))}
      </ul>
      <TabelBarang items={items} />
    </>
  );
}

/** FSD §9 — judul, aksi Tambah/Import, dan kolom cari. */
function KepalaDaftar({
  cari,
  onCari,
}: {
  cari: string;
  onCari: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
          Daftar Barang
        </h1>
        <div className="flex gap-2">
          <Link
            href="/toko/barang/baru"
            className={`${tombolUtama} hidden text-base md:inline-flex`}
          >
            + Tambah barang
          </Link>
          <Link href="/toko/import" className={`${tombolGaris} text-base`}>
            Import
          </Link>
        </div>
      </div>
      <input
        type="search"
        aria-label="Cari barang"
        placeholder="Cari barang…"
        value={cari}
        onChange={(e) => onCari(e.target.value)}
        className="rounded-btn border-garis bg-card shadow-card focus:border-marigold-kuat focus:ring-marigold/25 w-full border px-4 py-3 text-base transition duration-150 focus:ring-[3px] focus:outline-none"
      />
    </>
  );
}

export default function BarangPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");
  const [arsip, setArsip] = useState(false);
  const { items, memuat, gagal, muat } = useDaftarBarang(filter, cari, arsip);

  useEffect(() => {
    if (!router.isReady) return;
    setFilter(filterDariQuery(router.query.status));
  }, [router.isReady, router.query.status]);

  function gantiFilter(f: Filter) {
    setFilter(f);
    const tujuan = f === "semua" ? "/toko/barang" : `/toko/barang?status=${f}`;
    void router.replace(tujuan, undefined, { shallow: true });
  }

  return (
    <>
      <Head>
        <title>Daftar Barang — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-4">
          <KepalaDaftar cari={cari} onCari={setCari} />
          <ChipFilter
            filter={filter}
            arsip={arsip}
            onFilter={gantiFilter}
            onArsip={setArsip}
          />
          <IsiDaftar
            memuat={memuat}
            gagal={gagal}
            items={items}
            adaFilter={filter !== "semua" || cari.trim() !== ""}
            onMuat={() => void muat()}
          />
        </div>
      </AppShell>
    </>
  );
}
