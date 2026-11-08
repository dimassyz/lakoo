import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
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
import { ambilItem } from "@/lib/worker";

type Baris = SalesRecap["lines"][number];
type Awal = { tanggal: string; mode: Mode; nilai: Nilai };

/** FSD §0.4 — "Buka & perbaiki" memulihkan isian yang tertahan di antrean. */
function useAwalAntrean(): Awal | undefined {
  const router = useRouter();
  const id =
    typeof router.query.antrean === "string" ? router.query.antrean : undefined;
  const [awal, setAwal] = useState<Awal>();
  const dipakai = useRef(false);

  useEffect(() => {
    if (!id || dipakai.current) return;
    dipakai.current = true;
    void ambilItem(id).then((it) => {
      if (it?.kind !== "recap") return;
      setAwal({
        tanggal: it.payload.date,
        mode: it.payload.mode,
        nilai: Object.fromEntries(
          it.payload.lines.map((l) => [
            l.productId,
            l.qty ?? l.countedStock ?? 0,
          ]),
        ),
      });
    });
  }, [id]);

  return awal;
}

const tombolGeser =
  "rounded-btn border-line h-11 w-11 cursor-pointer border text-lg font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 enabled:hover:border-slate enabled:hover:bg-[#f3efe7] enabled:hover:text-navy enabled:active:translate-y-px disabled:cursor-not-allowed disabled:text-muted";

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
        className="rounded-btn border-line focus:border-marigold-kuat focus:ring-marigold/25 h-[52px] border px-3 transition duration-150 focus:ring-[3px] focus:outline-none"
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
  const tab =
    "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-btn border px-3 text-[15px] font-semibold transition duration-150 hover:border-slate hover:bg-[#f3efe7] hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";
  const gaya = (aktif: boolean) =>
    `${tab} ${aktif ? "border-navy text-navy" : "border-line text-ink"}`;

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
      <p className="text-muted">
        Tidak ada barang yang cocok dengan pencarian.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
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
  const gaya = bisa
    ? "bg-marigold text-navy enabled:hover:bg-[#d9932b] enabled:hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] enabled:active:translate-y-px"
    : "border border-line text-muted opacity-55";

  return (
    <div className="rounded-card border-line bg-surface sticky bottom-16 z-10 mt-4 border p-4 lg:bottom-0">
      <p className="angka text-muted">
        {jumlah} barang · {total} terjual · {rupiah(estimasi)}
      </p>
      <button
        type="button"
        disabled={!bisa || menyimpan}
        onClick={onSimpan}
        className={`rounded-btn focus-visible:outline-navy mt-2 flex h-[52px] w-full cursor-pointer items-center justify-center px-4 font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${gaya}`}
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
    <div className="space-y-4">
      <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
        Rekap Penjualan
      </h1>
      <KontrolTanggal tanggal={r.tanggal} ubah={r.setTanggal} />
      <p className="text-muted">
        {r.tanggal === hariIniWib() ? "Hari ini" : "Tanggal lampau"}
      </p>
      {r.data?.hasRecord ? (
        <p>Sudah ada rekap untuk tanggal ini — perubahan akan mengganti</p>
      ) : null}
      <TabMode mode={r.mode} ubah={r.setMode} />
      <input
        type="search"
        aria-label="Cari barang"
        placeholder="Cari barang…"
        value={r.cari}
        onChange={(e) => r.setCari(e.target.value)}
        className="rounded-btn border-line focus:border-marigold-kuat focus:ring-marigold/25 h-[52px] w-full border px-3 transition duration-150 focus:ring-[3px] focus:outline-none"
      />
      {r.toast ? (
        <p role="status" className="rounded-card border-line border p-3">
          {r.toast}
        </p>
      ) : null}
    </div>
  );
}

function BadanRekap({
  r,
  onPerbaiki,
}: {
  r: RekapLayar;
  onPerbaiki: (baris: Baris) => void;
}) {
  if (r.memuat) return <p className="text-muted">Memuat…</p>;

  if (r.gagal) {
    return (
      <div className="rounded-card border-line border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => void r.muat()}
          className="rounded-btn bg-marigold text-navy focus-visible:outline-navy mt-3 inline-flex h-[52px] cursor-pointer items-center justify-center px-4 font-semibold transition duration-150 hover:bg-[#d9932b] hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
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
  const awal = useAwalAntrean();
  const r = useRekapLayar(awal);
  const [sheet, setSheet] = useState<Baris | null>(null);

  return (
    <>
      <Head>
        <title>Rekap Penjualan — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-6">
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
