import { useState } from "react";
import type { ProductSummary, StockIn } from "@/lib/api";
import {
  pilihBarang,
  ribuan,
  type BarisMasuk as Baris,
  type KoreksiMasuk,
} from "@/lib/barangMasuk";
import { rupiah, tanggalPendek } from "@/lib/ui";

const input =
  "rounded-btn border-line h-[52px] w-full border px-3 transition duration-150 focus:border-marigold-kuat focus:ring-4 focus:ring-marigold/25 focus:outline-none";
const label = "text-muted block text-[13px] font-semibold";
const teksError = "text-danger text-[13px] font-semibold";
const tombolKecil =
  "rounded-btn border-line inline-flex min-h-11 cursor-pointer items-center border px-3 text-[13px] font-semibold transition duration-150 hover:border-slate hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";

type PropsUbah = { baris: Baris; onUbah: (b: Baris) => void };

/** FSD §8 — kombobox: ketik → saran barang aktif, opsi terakhir = barang baru. */
function PilihBarang({
  baris,
  produk,
  onUbah,
}: PropsUbah & { produk: ProductSummary[] }) {
  const id = `produk-${baris.kunci}`;
  const nama = baris.nama.trim();
  const opsiBaru = nama !== "" && baris.productId === null && !baris.baru;

  return (
    <>
      <label htmlFor={id} className={label}>
        Barang
      </label>
      <input
        id={id}
        list={`${id}-saran`}
        value={baris.nama}
        autoComplete="off"
        placeholder="Ketik nama barang"
        className={input}
        onChange={(e) => onUbah(pilihBarang(baris, e.target.value, produk))}
      />
      <datalist id={`${id}-saran`}>
        {produk.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
        {opsiBaru ? (
          <option value={`+ Tambah '${nama}' sebagai barang baru`} />
        ) : null}
      </datalist>
    </>
  );
}

function AngkaBaris({ baris, onUbah }: PropsUbah) {
  const id = `produk-${baris.kunci}`;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor={`${id}-qty`} className={label}>
          Jumlah
        </label>
        <input
          id={`${id}-qty`}
          inputMode="numeric"
          value={baris.qty}
          placeholder="0"
          className={input}
          onChange={(e) =>
            onUbah({ ...baris, qty: e.target.value.replace(/\D/g, "") })
          }
        />
      </div>
      <div>
        <label htmlFor={`${id}-beli`} className={label}>
          Harga beli / satuan
        </label>
        <input
          id={`${id}-beli`}
          inputMode="numeric"
          value={ribuan(baris.unitCost)}
          placeholder="0"
          className={input}
          onChange={(e) => onUbah({ ...baris, unitCost: e.target.value })}
        />
      </div>
    </div>
  );
}

function HargaJual({ baris, onUbah }: PropsUbah) {
  const id = `produk-${baris.kunci}-jual`;

  return (
    <div>
      <label htmlFor={id} className={label}>
        Harga jual (barang baru)
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={ribuan(baris.sellPrice)}
        placeholder="0"
        className={input}
        onChange={(e) => onUbah({ ...baris, sellPrice: e.target.value })}
      />
    </div>
  );
}

type PropsBaris = PropsUbah & {
  produk: ProductSummary[];
  error?: string;
  bisaBuang: boolean;
  onBuang: () => void;
};

/** FSD §8 — satu baris nota. */
export function BarisNota({
  baris,
  produk,
  error,
  bisaBuang,
  onUbah,
  onBuang,
}: PropsBaris) {
  return (
    <li className="rounded-card border-line bg-card shadow-card space-y-4 border p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <PilihBarang baris={baris} produk={produk} onUbah={onUbah} />
        </div>
        {bisaBuang ? (
          <button
            type="button"
            aria-label={`Hapus baris ${baris.nama.trim() || "ini"}`}
            onClick={onBuang}
            className="rounded-btn border-line hover:border-slate hover:text-navy focus-visible:outline-navy mt-6 h-11 w-11 cursor-pointer border text-lg transition duration-150 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
          >
            ×
          </button>
        ) : null}
      </div>
      <AngkaBaris baris={baris} onUbah={onUbah} />
      {baris.baru ? <HargaJual baris={baris} onUbah={onUbah} /> : null}
      {error ? (
        <p role="alert" className={teksError}>
          {error}
        </p>
      ) : null}
    </li>
  );
}

type PropsKoreksi = {
  item: StockIn;
  koreksi: KoreksiMasuk;
  setKoreksi: (k: KoreksiMasuk) => void;
  pesan: string;
  onSimpan: () => void;
  onBatal: () => void;
};

type PropsKoreksiIsi = {
  item: StockIn;
  koreksi: KoreksiMasuk;
  setKoreksi: (k: KoreksiMasuk) => void;
};

function AngkaKoreksi({ item, koreksi, setKoreksi }: PropsKoreksiIsi) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor={`${item.id}-kq`} className={label}>
          Jumlah
        </label>
        <input
          id={`${item.id}-kq`}
          inputMode="numeric"
          value={String(koreksi.qty ?? item.qty)}
          className={input}
          onChange={(e) =>
            setKoreksi({ ...koreksi, qty: Number(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label htmlFor={`${item.id}-kh`} className={label}>
          Harga beli
        </label>
        <input
          id={`${item.id}-kh`}
          inputMode="numeric"
          value={ribuan(String(koreksi.unitCost ?? item.unitCost))}
          className={input}
          onChange={(e) =>
            setKoreksi({
              ...koreksi,
              unitCost: Number(e.target.value.replace(/\D/g, "")) || 0,
            })
          }
        />
      </div>
    </div>
  );
}

function TanggalKoreksi({ item, koreksi, setKoreksi }: PropsKoreksiIsi) {
  return (
    <div>
      <label htmlFor={`${item.id}-kt`} className={label}>
        Tanggal nota
      </label>
      <input
        id={`${item.id}-kt`}
        type="date"
        value={koreksi.receivedOn ?? item.receivedOn}
        className={input}
        onChange={(e) => setKoreksi({ ...koreksi, receivedOn: e.target.value })}
      />
    </div>
  );
}

function TombolKoreksi({
  onSimpan,
  onBatal,
}: {
  onSimpan: () => void;
  onBatal: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onSimpan}
        className="rounded-btn bg-marigold text-navy focus-visible:outline-navy inline-flex min-h-11 cursor-pointer items-center px-4 text-[13px] font-semibold transition duration-150 hover:bg-[#d9932b] hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
      >
        Simpan koreksi
      </button>
      <button type="button" onClick={onBatal} className={tombolKecil}>
        Batal
      </button>
    </div>
  );
}

/** FSD §8 — Ubah qty, harga, dan tanggal (jendela ≤ 7 hari dijaga server). */
function FormKoreksi({
  item,
  koreksi,
  setKoreksi,
  pesan,
  onSimpan,
  onBatal,
}: PropsKoreksi) {
  return (
    <li className="rounded-card border-line bg-card shadow-card space-y-4 border p-4">
      <p className="font-semibold">{item.productName}</p>
      <AngkaKoreksi item={item} koreksi={koreksi} setKoreksi={setKoreksi} />
      <TanggalKoreksi item={item} koreksi={koreksi} setKoreksi={setKoreksi} />
      {pesan ? (
        <p role="alert" className={teksError}>
          {pesan}
        </p>
      ) : null}
      <TombolKoreksi onSimpan={onSimpan} onBatal={onBatal} />
    </li>
  );
}

type PropsAksi = {
  konfirmasi: boolean;
  onKonfirmasi: (v: boolean) => void;
  onUbah: () => void;
  onHapus: () => void;
};

function AksiRiwayat({ konfirmasi, onKonfirmasi, onUbah, onHapus }: PropsAksi) {
  if (konfirmasi) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onHapus}
          className="rounded-btn border-ink hover:bg-navy focus-visible:outline-navy inline-flex min-h-11 cursor-pointer items-center border px-3 text-[13px] font-semibold transition duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
        >
          Ya, hapus
        </button>
        <button
          type="button"
          onClick={() => onKonfirmasi(false)}
          className={tombolKecil}
        >
          Batal
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={onUbah} className={tombolKecil}>
        Ubah
      </button>
      <button
        type="button"
        onClick={() => onKonfirmasi(true)}
        className={tombolKecil}
      >
        Hapus
      </button>
    </div>
  );
}

type PropsRiwayat = {
  item: StockIn;
  onUbah: (id: string, patch: KoreksiMasuk) => Promise<string | null>;
  onHapus: (id: string) => Promise<string | null>;
};

/** FSD §8 — baris riwayat 30 hari; hanya `editable` yang bisa dikoreksi. */
export function BarisRiwayat({ item, onUbah, onHapus }: PropsRiwayat) {
  const [koreksi, setKoreksi] = useState<KoreksiMasuk | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [pesan, setPesan] = useState("");

  async function simpan() {
    if (!koreksi) return;
    const gagal = await onUbah(item.id, koreksi);
    setPesan(gagal ?? "");
    if (!gagal) setKoreksi(null);
  }

  async function buang() {
    const gagal = await onHapus(item.id);
    setPesan(gagal ?? "");
    if (!gagal) setKonfirmasi(false);
  }

  if (koreksi) {
    return (
      <FormKoreksi
        item={item}
        koreksi={koreksi}
        setKoreksi={setKoreksi}
        pesan={pesan}
        onSimpan={() => void simpan()}
        onBatal={() => {
          setKoreksi(null);
          setPesan("");
        }}
      />
    );
  }

  return (
    <li className="rounded-card border-line bg-card shadow-card flex items-center gap-2 border p-4">
      <div className="flex-1">
        <p className="font-semibold">{item.productName}</p>
        <p className="angka text-muted text-[13px]">
          {item.qty} × {rupiah(item.unitCost)} ·{" "}
          {tanggalPendek(item.receivedOn)}
        </p>
        {pesan ? (
          <p role="alert" className={teksError}>
            {pesan}
          </p>
        ) : null}
      </div>
      {item.editable ? (
        <AksiRiwayat
          konfirmasi={konfirmasi}
          onKonfirmasi={setKonfirmasi}
          onUbah={() => setKoreksi({})}
          onHapus={() => void buang()}
        />
      ) : null}
    </li>
  );
}
