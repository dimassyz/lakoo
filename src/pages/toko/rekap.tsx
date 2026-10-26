import Head from "next/head";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { BarisOpname, BarisQuantity, SheetStok } from "@/components/RekapBaris";
import { api, type SalesRecap } from "@/lib/api";
import {
  useRekapLayar,
  type Mode,
  type Nilai,
  type RekapLayar,
} from "@/lib/rekap";
import { batasTanggal, geserHari, hariIniWib, rupiah } from "@/lib/ui";

type Baris = SalesRecap["lines"][number];

const tombolGeser =
  "h-10 w-10 rounded-card border border-muted text-lg font-semibold disabled:text-muted";

/** FSD §7 — geser per hari + pemilih ≤ hari ini dan ≥ 365 hari lalu. */
function KontrolTanggal({
  tanggal,
  ubah,
}: {
  tanggal: string;
  ubah: (t: string) => void;
}) {
  const { min, max } = batasTanggal();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Hari sebelumnya"
        className={tombolGeser}
        disabled={tanggal <= min}
        onClick={() => ubah(geserHari(tanggal, -1))}
      >
        ‹
      </button>
      <input
        type="date"
        aria-label="Tanggal rekap"
        value={tanggal}
        min={min}
        max={max}
        onChange={(e) => ubah(e.target.value || hariIniWib())}
        className="rounded-card border-muted border px-3 py-2"
      />
      <button
        type="button"
        aria-label="Hari berikutnya"
        className={tombolGeser}
        disabled={tanggal >= max}
        onClick={() => ubah(geserHari(tanggal, 1))}
      >
        ›
      </button>
    </div>
  );
}

function TabMode({ mode, ubah }: { mode: Mode; ubah: (m: Mode) => void }) {
  const tab = "flex-1 rounded-card border px-3 py-2 text-[15px] font-semibold";
  const gaya = (aktif: boolean) =>
    `${tab} ${aktif ? "border-safe text-safe" : "border-muted text-ink"}`;

  return (
    <div className="flex gap-2" role="tablist" aria-label="Mode rekap">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "quantity"}
        className={gaya(mode === "quantity")}
        onClick={() => ubah("quantity")}
      >
        Jumlah terjual
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "opname"}
        className={gaya(mode === "opname")}
        onClick={() => ubah("opname")}
      >
        Hitung sisa stok (opname)
      </button>
    </div>
  );
}

function DaftarRekap({
  baris,
  nilai,
  mode,
  tanggal,
  error,
  onUbah,
  onPerbaiki,
}: {
  baris: SalesRecap["lines"];
  nilai: Nilai;
  mode: Mode;
  tanggal: string;
  error: Record<string, string>;
  onUbah: (id: string, n: number | undefined) => void;
  onPerbaiki: (baris: Baris) => void;
}) {
  if (baris.length === 0) {
    return (
      <p className="text-muted text-[15px]">
        Tidak ada barang yang cocok dengan pencarian.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {baris.map((l) =>
        mode === "quantity" ? (
          <BarisQuantity
            key={l.productId}
            baris={l}
            nilai={nilai[l.productId] ?? l.recordedQty}
            error={error[l.productId]}
            onUbah={(n) => onUbah(l.productId, n)}
            onPerbaiki={() => onPerbaiki(l)}
          />
        ) : (
          <BarisOpname
            key={l.productId}
            baris={l}
            tanggal={tanggal}
            nilai={nilai[l.productId]}
            error={error[l.productId]}
            onUbah={(n) => onUbah(l.productId, n)}
          />
        ),
      )}
    </ul>
  );
}

function Footer({
  jumlah,
  total,
  estimasi,
  bisa,
  menyimpan,
  onSimpan,
}: {
  jumlah: number;
  total: number;
  estimasi: number;
  bisa: boolean;
  menyimpan: boolean;
  onSimpan: () => void;
}) {
  const gaya = bisa ? "bg-safe text-white" : "border border-muted text-muted";

  return (
    <div className="rounded-card border-muted bg-surface sticky bottom-16 z-10 mt-4 border p-3 lg:bottom-0">
      <p className="text-muted text-[15px]">
        {jumlah} barang · {total} terjual · {rupiah(estimasi)}
      </p>
      <button
        type="button"
        disabled={!bisa || menyimpan}
        onClick={onSimpan}
        className={`rounded-card mt-2 w-full px-4 py-3 font-semibold ${gaya}`}
      >
        {menyimpan
          ? "Menyimpan…"
          : bisa
            ? "Simpan rekap"
            : "Belum ada perubahan"}
      </button>
    </div>
  );
}

/** FSD §7 — bottom sheet "Stok sebenarnya sekarang?" lalu muat ulang. */
function SheetPerbaiki({
  baris,
  onTutup,
  onSelesai,
}: {
  baris: Baris;
  onTutup: () => void;
  onSelesai: (pesan: string, berhasil: boolean) => void;
}) {
  async function simpan(n: number) {
    const { error } = await api.POST(
      "/products/{productId}/stock-adjustments",
      {
        params: { path: { productId: baris.productId } },
        body: { countedStock: n },
      },
    );
    onSelesai(
      error ? "Gagal menyimpan stok. Coba lagi." : "Stok diperbaiki",
      !error,
    );
  }

  return (
    <SheetStok
      nama={baris.name}
      stok={baris.currentStock}
      onBatal={onTutup}
      onSimpan={(n) => void simpan(n)}
    />
  );
}

function KepalaRekap({ r }: { r: RekapLayar }) {
  return (
    <>
      <h1 className="text-2xl font-bold">Rekap Penjualan</h1>
      <KontrolTanggal tanggal={r.tanggal} ubah={r.setTanggal} />
      <p className="text-muted text-[15px]">
        {r.tanggal === hariIniWib() ? "Hari ini" : "Tanggal lampau"}
      </p>
      {r.data?.hasRecord ? (
        <p className="text-[15px]">
          Sudah ada rekap untuk tanggal ini — perubahan akan mengganti
        </p>
      ) : null}
      <TabMode mode={r.mode} ubah={r.setMode} />
      <input
        type="search"
        aria-label="Cari barang"
        placeholder="Cari barang…"
        value={r.cari}
        onChange={(e) => r.setCari(e.target.value)}
        className="rounded-card border-muted w-full border px-3 py-2"
      />
      {r.toast ? (
        <p
          role="status"
          className="rounded-card border-muted border p-2 text-[15px]"
        >
          {r.toast}
        </p>
      ) : null}
    </>
  );
}

function BadanRekap({
  r,
  onPerbaiki,
}: {
  r: RekapLayar;
  onPerbaiki: (baris: Baris) => void;
}) {
  if (r.memuat) return <p className="text-muted text-[15px]">Memuat…</p>;

  if (r.gagal) {
    return (
      <div className="rounded-card border-muted border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => void r.muat()}
          className="rounded-card bg-safe mt-3 px-4 py-3 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <DaftarRekap
      baris={r.baris}
      nilai={r.nilai}
      mode={r.mode}
      tanggal={r.tanggal}
      error={r.error}
      onUbah={r.ubah}
      onPerbaiki={onPerbaiki}
    />
  );
}

export default function RekapPage() {
  const r = useRekapLayar();
  const [sheet, setSheet] = useState<Baris | null>(null);

  return (
    <>
      <Head>
        <title>Rekap Penjualan — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-3">
          <KepalaRekap r={r} />
          <BadanRekap r={r} onPerbaiki={setSheet} />
          <Footer
            jumlah={r.angka.jumlah}
            total={r.angka.total}
            estimasi={r.angka.estimasi}
            bisa={r.bisa}
            menyimpan={r.menyimpan}
            onSimpan={() => void r.simpan()}
          />
        </div>
      </AppShell>
      {sheet ? (
        <SheetPerbaiki
          baris={sheet}
          onTutup={() => setSheet(null)}
          onSelesai={(pesan, berhasil) => {
            setSheet(null);
            r.setToast(pesan);
            if (berhasil) void r.muat();
          }}
        />
      ) : null}
    </>
  );
}
