import { useState } from "react";
import type { ProductSummary } from "@/lib/api";
import { parseNota, type BarisMasuk } from "@/lib/barangMasuk";

const tombolGaris =
  "rounded-btn border-line inline-flex min-h-11 items-center border px-4 font-semibold";

type Props = {
  produk: ProductSummary[];
  onIsi: (daftar: BarisMasuk[]) => void;
  onTutup: () => void;
};

/** FSD §16 (Could) — tempel nota, parser jalan di browser, tidak menyimpan apa pun. */
export function NotaTempel({ produk, onIsi, onTutup }: Props) {
  const [teks, setTeks] = useState("");

  return (
    <div className="rounded-card border-line space-y-4 border p-4">
      <label
        htmlFor="teks-nota"
        className="text-muted block text-[13px] font-semibold"
      >
        Tempel teks nota
      </label>
      <textarea
        id="teks-nota"
        rows={6}
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        placeholder={"Teh Celup 10 6.200\nKopi Sachet 24 3.100"}
        className="rounded-btn border-line w-full border px-3 py-2 font-mono text-[16px]"
      />
      <p className="text-muted text-[13px]">
        Pola per baris: nama, jumlah, harga beli. Baris yang tidak terbaca tetap
        masuk ke form untuk diketik manual.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onIsi(parseNota(teks, produk))}
          disabled={teks.trim() === ""}
          className="rounded-btn bg-navy inline-flex h-[52px] items-center px-4 font-semibold text-white disabled:opacity-40"
        >
          Isi form
        </button>
        <button type="button" onClick={onTutup} className={tombolGaris}>
          Batal
        </button>
      </div>
    </div>
  );
}
