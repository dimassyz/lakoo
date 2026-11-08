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
  "rounded-btn border-line inline-flex min-h-11 items-center border px-4 font-semibold";

function gayaChip(aktif: boolean) {
  /* DESIGN-V3 §3/§7 — chip filter: pill penuh, target sentuh 44px; nonaktif
     lunak (bukan pill status jenuh ala board), aktif solid ink (ruling R-T2). */
  const dasar =
    "rounded-pill inline-flex min-h-11 items-center border px-4 text-[13px] font-semibold whitespace-nowrap";
  return `${dasar} ${aktif ? "border-navy bg-navy text-white" : "border-line text-ink"}`;
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
      <label className="flex min-h-11 items-center gap-2 text-base">
        <input
          type="checkbox"
          checked={arsip}
          onChange={(e) => onArsip(e.target.checked)}
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
        className="md:rounded-card md:border-garis md:bg-card md:shadow-card block p-4 md:border"
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
              className="font-semibold"
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
            <tr key={p.id} className="border-garis border-b last:border-b-0">
              <td className="px-2 py-3">
                <Link
                  href={`/toko/barang/${p.id}`}
                  className="text-navy font-semibold"
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
        <Link
          href="/toko/barang/baru"
          className="rounded-btn bg-navy inline-flex min-h-11 items-center px-4 font-semibold text-white"
        >
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
          className="rounded-btn bg-navy mt-4 inline-flex min-h-11 items-center px-4 font-semibold text-white"
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
            className="rounded-btn bg-navy hidden min-h-11 items-center px-4 text-base font-semibold text-white md:inline-flex"
          >
            + Tambah barang
          </Link>
          <Link
            href="/toko/import"
            className="rounded-btn border-line inline-flex min-h-11 items-center border px-4 text-base font-semibold"
          >
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
        className="rounded-btn border-garis bg-card shadow-card w-full border px-4 py-3 text-base"
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
