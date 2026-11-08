import { useState } from "react";
import type { ProductSummary } from "@/lib/api";
import { parseNota, type BarisMasuk } from "@/lib/barangMasuk";

const tombolGaris =
  "rounded-btn border-line inline-flex min-h-11 cursor-pointer items-center border px-4 font-semibold transition duration-150 hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";

type Props = {
  produk: ProductSummary[];
  onIsi: (daftar: BarisMasuk[]) => void;
  onTutup: () => void;
};

/** FSD §16 (Could) — tempel nota, parser jalan di browser, tidak menyimpan apa pun. */
export function NotaTempel({ produk, onIsi, onTutup }: Props) {
  const [teks, setTeks] = useState("");

  return (
    <div className="rounded-card border-line bg-card shadow-card space-y-4 border p-4">
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
        className="rounded-btn border-line focus:border-marigold-kuat focus:ring-marigold/25 w-full border px-3 py-2 font-mono text-[16px] transition duration-150 focus:ring-4 focus:outline-none"
      />
      <p className="text-muted text-[13px]">
        Pola per baris: nama, jumlah, harga beli — format WhatsApp seperti
        &quot;10x Nama @1.500&quot; atau &quot;Nama 10 x 1500&quot; juga
        terbaca. Baris judul dan total dilewati; baris lain yang tidak terbaca
        tetap masuk ke form untuk diketik manual.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onIsi(parseNota(teks, produk))}
          disabled={teks.trim() === ""}
          className="rounded-btn bg-marigold text-navy focus-visible:outline-navy inline-flex h-[52px] cursor-pointer items-center px-4 font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 enabled:hover:bg-[#d9932b] enabled:hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
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
