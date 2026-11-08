import Link from "next/link";
import { useState } from "react";
import type { SalesRecap } from "@/lib/api";
import { rupiah } from "@/lib/ui";

type Baris = SalesRecap["lines"][number];

const tombol =
  "rounded-btn border-line h-11 w-11 cursor-pointer border text-lg font-semibold transition duration-150 hover:border-slate hover:bg-[#f3efe7] hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";
const angka =
  "rounded-btn border-line h-11 border px-2 text-center text-lg transition duration-150 focus:border-marigold-kuat focus:ring-4 focus:ring-marigold/25 focus:outline-none";

/**
 * Baca ketikan field jumlah (QA-4 M-1): koma/titik ditandai sebagai upaya
 * desimal supaya field bisa menolak + memberi petunjuk; selain itu hanya
 * digit yang diambil, konsisten dengan field angka lain di aplikasi.
 */
function bacaJumlah(mentah: string): { desimal: boolean; nilai: number } {
  if (/[.,]/.test(mentah)) return { desimal: true, nilai: 0 };
  const digit = mentah.replace(/\D/g, "");
  return { desimal: false, nilai: digit === "" ? 0 : Number(digit) };
}

function PetunjukBulat({ teks }: { teks: string }) {
  return (
    <p role="alert" className="text-danger mt-1 text-[13px] font-semibold">
      {teks}
    </p>
  );
}

function Stepper({
  nama,
  nilai,
  maks,
  onUbah,
}: {
  nama: string;
  nilai: number;
  maks: number;
  onUbah: (n: number) => void;
}) {
  const [peringatan, setPeringatan] = useState(false);
  const set = (n: number) => onUbah(Math.min(maks, Math.max(0, n)));

  // QA-4 M-1: desimal ditolak di field + diberi petunjuk — nilai desimal
  // tidak pernah mencapai antrean simpan.
  const ketik = (mentah: string) => {
    const baca = bacaJumlah(mentah);
    setPeringatan(baca.desimal);
    if (!baca.desimal) set(baca.nilai);
  };

  return (
    <div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className={tombol}
          aria-label={`Kurangi ${nama}`}
          onClick={() => set(nilai - 1)}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={nilai}
          aria-label={`Jumlah terjual ${nama}`}
          onChange={(e) => ketik(e.target.value)}
          className={`${angka} w-16`}
        />
        <button
          type="button"
          className={tombol}
          aria-label={`Tambah ${nama}`}
          onClick={() => set(nilai + 1)}
        >
          +
        </button>
      </div>
      {peringatan ? <PetunjukBulat teks="Jumlah harus bilangan bulat" /> : null}
    </div>
  );
}

/** FSD §7 mode "Jumlah terjual": stepper − [angka] +. */
export function BarisQuantity({
  baris,
  nilai,
  error,
  onUbah,
  onPerbaiki,
}: {
  baris: Baris;
  nilai: number;
  error?: string;
  onUbah: (n: number) => void;
  onPerbaiki: () => void;
}) {
  const maks = baris.currentStock + baris.recordedQty;

  return (
    <li
      className={`rounded-card border bg-white p-4 ${error ? "border-danger" : "border-line"}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{baris.name}</p>
        <p className="angka text-muted text-[14px]">
          {rupiah(nilai * baris.sellPrice)}
        </p>
      </div>
      <p className="text-muted text-[14px]">stok {baris.currentStock}</p>
      <Stepper nama={baris.name} nilai={nilai} maks={maks} onUbah={onUbah} />
      {error ? (
        <p className="text-danger mt-2">
          {error}{" "}
          <button
            type="button"
            onClick={onPerbaiki}
            className="hover:text-marigold-kuat focus-visible:outline-navy cursor-pointer underline transition duration-150 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Perbaiki stok
          </button>
        </p>
      ) : null}
    </li>
  );
}

/** Field "sisa sekarang" opname — hanya bilangan bulat (QA-4 M-1). */
function InputSisa({
  nama,
  nilai,
  onUbah,
}: {
  nama: string;
  nilai?: number;
  onUbah: (n: number | undefined) => void;
}) {
  const [peringatan, setPeringatan] = useState(false);

  const ketik = (mentah: string) => {
    if (mentah === "") {
      setPeringatan(false);
      onUbah(undefined);
      return;
    }
    const baca = bacaJumlah(mentah);
    setPeringatan(baca.desimal);
    if (!baca.desimal) onUbah(baca.nilai);
  };

  return (
    <>
      <label className="mt-2 flex items-center gap-2">
        <span className="text-muted">sisa sekarang</span>
        <input
          type="text"
          inputMode="numeric"
          value={nilai ?? ""}
          aria-label={`Sisa stok ${nama}`}
          onChange={(e) => ketik(e.target.value)}
          className={`${angka} w-20`}
        />
      </label>
      {peringatan ? (
        <PetunjukBulat teks="Sisa stok harus bilangan bulat" />
      ) : null}
    </>
  );
}

/** FSD §7 mode "Hitung sisa stok (opname)": sisa kosong secara bawaan. */
export function BarisOpname({
  baris,
  tanggal,
  nilai,
  error,
  onUbah,
}: {
  baris: Baris;
  tanggal: string;
  nilai?: number;
  error?: string;
  onUbah: (n: number | undefined) => void;
}) {
  const sold =
    nilai === undefined
      ? null
      : baris.morningStock + baris.stockInOnDate - nilai;

  return (
    <li
      className={`rounded-card border bg-white p-4 ${error ? "border-danger" : "border-line"}`}
    >
      <p className="font-semibold">{baris.name}</p>
      <p className="text-muted text-[14px]">
        pagi {baris.morningStock}
        {baris.stockInOnDate > 0 ? ` · +masuk ${baris.stockInOnDate}` : ""}
      </p>
      <InputSisa nama={baris.name} nilai={nilai} onUbah={onUbah} />
      {sold === null ? null : <p className="mt-1">terjual {sold}</p>}
      {error ? (
        <p className="text-danger mt-1">
          {error}{" "}
          <Link
            href={`/toko/barang-masuk?date=${tanggal}`}
            className="hover:text-marigold-kuat focus-visible:outline-navy cursor-pointer underline transition duration-150 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            catat barang masuk
          </Link>
        </p>
      ) : null}
    </li>
  );
}

/** FSD §7 — bottom sheet "Stok sebenarnya sekarang?". */
export function SheetStok({
  nama,
  stok,
  onBatal,
  onSimpan,
}: {
  nama: string;
  stok: number;
  onBatal: () => void;
  onSimpan: (n: number) => void;
}) {
  const [nilai, setNilai] = useState(String(stok));

  return (
    <div className="bg-ink/40 fixed inset-0 z-20 flex items-end p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-stok"
        className="rounded-card border-line bg-surface w-full border p-4"
      >
        <h2 id="sheet-stok" className="text-[19px] font-semibold">
          Stok sebenarnya sekarang?
        </h2>
        <p className="text-muted text-[14px]">{nama}</p>
        <input
          type="text"
          inputMode="numeric"
          value={nilai}
          aria-label="Stok sebenarnya"
          onChange={(e) => {
            // Stok hanya bilangan bulat — koma/titik tidak diterima.
            if (/[.,]/.test(e.target.value)) return;
            setNilai(e.target.value.replace(/\D/g, ""));
          }}
          className={`${angka} mt-3 w-full`}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onBatal}
            className="rounded-btn border-line hover:bg-navy focus-visible:outline-navy flex h-[52px] flex-1 cursor-pointer items-center justify-center border px-4 font-semibold transition duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSimpan(Number(nilai) || 0)}
            className="rounded-btn bg-marigold text-navy focus-visible:outline-navy flex h-[52px] flex-1 cursor-pointer items-center justify-center px-4 font-semibold transition duration-150 hover:bg-[#d9932b] hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
