import Link from "next/link";
import { useState } from "react";
import type { SalesRecap } from "@/lib/api";
import { rupiah } from "@/lib/ui";

type Baris = SalesRecap["lines"][number];

const tombol =
  "h-10 w-10 rounded-card border border-muted text-lg font-semibold";
const angka = "rounded-card border border-muted px-2 py-2 text-center text-lg";

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
  const set = (n: number) => onUbah(Math.min(maks, Math.max(0, n)));

  return (
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
        type="number"
        inputMode="numeric"
        min={0}
        max={maks}
        value={nilai}
        aria-label={`Jumlah terjual ${nama}`}
        onChange={(e) => set(Number(e.target.value) || 0)}
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
      className={`rounded-card border p-3 ${error ? "border-ink" : "border-muted"}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{baris.name}</p>
        <p className="text-muted text-[15px]">
          {rupiah(nilai * baris.sellPrice)}
        </p>
      </div>
      <p className="text-muted text-[15px]">stok {baris.currentStock}</p>
      <Stepper nama={baris.name} nilai={nilai} maks={maks} onUbah={onUbah} />
      {error ? (
        <p className="mt-2 text-[15px]">
          {error}{" "}
          <button type="button" onClick={onPerbaiki} className="underline">
            Perbaiki stok
          </button>
        </p>
      ) : null}
    </li>
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
      className={`rounded-card border p-3 ${error ? "border-ink" : "border-muted"}`}
    >
      <p className="font-semibold">{baris.name}</p>
      <p className="text-muted text-[15px]">
        pagi {baris.morningStock}
        {baris.stockInOnDate > 0 ? ` · +masuk ${baris.stockInOnDate}` : ""}
      </p>
      <label className="mt-2 flex items-center gap-2 text-[15px]">
        <span className="text-muted">sisa sekarang</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={nilai ?? ""}
          aria-label={`Sisa stok ${baris.name}`}
          onChange={(e) =>
            onUbah(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className={`${angka} w-20`}
        />
      </label>
      {sold === null ? null : (
        <p className="mt-1 text-[15px]">terjual {sold}</p>
      )}
      {error ? (
        <p className="mt-1 text-[15px]">
          {error}{" "}
          <Link
            href={`/toko/barang-masuk?date=${tanggal}`}
            className="underline"
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
        className="rounded-card border-muted bg-surface w-full border p-4"
      >
        <h2 id="sheet-stok" className="font-semibold">
          Stok sebenarnya sekarang?
        </h2>
        <p className="text-muted text-[15px]">{nama}</p>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={nilai}
          aria-label="Stok sebenarnya"
          onChange={(e) => setNilai(e.target.value)}
          className={`${angka} mt-3 w-full`}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onBatal}
            className="rounded-card border-muted flex-1 border px-4 py-3 font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSimpan(Number(nilai) || 0)}
            className="rounded-card bg-safe flex-1 px-4 py-3 font-semibold text-white"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
