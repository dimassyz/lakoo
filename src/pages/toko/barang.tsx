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
import { labelStatus, rupiah, tanggalPendek } from "@/lib/ui";

const tombolGaris = "rounded-card border-muted border px-4 py-3 font-semibold";

function gayaChip(aktif: boolean) {
  const dasar =
    "rounded-card border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap";
  return `${dasar} ${aktif ? "border-safe text-safe" : "border-muted text-ink"}`;
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
      <label className="flex items-center gap-2 text-[15px]">
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
        className="rounded-card border-muted block border p-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">{p.name}</p>
          <p className="text-muted text-[13px]">{labelStatus(p.status)}</p>
        </div>
        <p className="text-muted text-[15px]">
          stok {p.stock} · {rupiah(p.lockedValue)} terkunci
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
      <tr className="border-muted border-b text-left">
        {KOLOM.map((c) => (
          <th
            key={c.kunci}
            scope="col"
            aria-sort={
              kolom === c.kunci ? (naik ? "ascending" : "descending") : "none"
            }
            className="py-2 text-[13px]"
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

  return (
    <table className="hidden w-full lg:table">
      <KepalaTabel kolom={kolom} naik={naik} onKlik={klik} />
      <tbody>
        {baris.map((p) => (
          <tr key={p.id} className="border-muted border-b">
            <td className="py-2">
              <Link href={`/toko/barang/${p.id}`} className="font-semibold">
                {p.name}
              </Link>
            </td>
            <td>{labelStatus(p.status)}</td>
            <td>{p.stock}</td>
            <td>{rupiah(p.lastCost)}</td>
            <td>{rupiah(p.sellPrice)}</td>
            <td>{rupiah(p.lockedValue)}</td>
            <td>{p.lastSaleDate ? tanggalPendek(p.lastSaleDate) : "Belum"}</td>
            <td>{p.priorityScore ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kosong({ adaFilter }: { adaFilter: boolean }) {
  if (adaFilter) {
    return (
      <p className="text-muted text-[15px]">
        Tidak ada barang yang cocok dengan filter atau pencarian ini.
      </p>
    );
  }

  return (
    <div className="rounded-card border-muted border p-4">
      <p className="font-semibold">Belum ada barang.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/toko/barang/baru"
          className="rounded-card bg-safe px-4 py-3 font-semibold text-white"
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
  if (memuat) return <p className="text-muted text-[15px]">Memuat…</p>;

  if (gagal) {
    return (
      <div className="rounded-card border-muted border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={onMuat}
          className="rounded-card bg-safe mt-3 px-4 py-3 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (items.length === 0) return <Kosong adaFilter={adaFilter} />;

  return (
    <>
      <ul className="space-y-2 lg:hidden">
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
        <h1 className="text-2xl font-bold">Daftar Barang</h1>
        <div className="flex gap-2">
          <Link
            href="/toko/barang/baru"
            className="rounded-card bg-safe px-3 py-2 text-[15px] font-semibold text-white"
          >
            + Tambah barang
          </Link>
          <Link
            href="/toko/import"
            className="rounded-card border-muted border px-3 py-2 text-[15px] font-semibold"
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
        className="rounded-card border-muted w-full border px-3 py-2"
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
        <div className="space-y-3">
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
