import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/NavBar";
import { BagianRencana } from "@/components/Rencana";
import { SheetStok } from "@/components/RekapBaris";
import { ShareWA } from "@/components/ShareWA";
import { WeekChart } from "@/components/WeekChart";
import type { ProductDetail } from "@/lib/api";
import {
  useAksiDetail,
  useAksiRencana,
  useAksiTahap,
  useProduk,
  useRencana,
} from "@/lib/detailBarang";
import { rupiah, tanggalPendek } from "@/lib/ui";
import { ChipStatus } from "@/components/ChipStatus";

const tombolGaris =
  "rounded-btn border-line inline-flex min-h-11 items-center border px-4 text-base font-semibold";
const tombolUtama =
  "rounded-btn bg-navy inline-flex h-[52px] items-center px-4 text-base font-semibold text-white";

type Jalan = (fn: () => Promise<string | null>) => void;

/** FSD §0.6 — kalimat bantu di bawah label status. */
function kalimatStatus(p: ProductDetail): string {
  if (p.status === "stok_habis") return "Stok 0";
  if (p.status === "sekarat" || p.status === "mati")
    return `${p.daysSinceLastSale ?? 0} hari tidak laku`;
  if (p.reason) return p.reason;
  if (p.daysUntilEmpty !== null) return `±${p.daysUntilEmpty} hari lagi habis`;
  return "";
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex flex-col text-base md:flex-row md:justify-between md:gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="angka text-navy font-semibold">{nilai}</dd>
    </div>
  );
}

/** FSD §11.1 — judul barang + chip status + kalimat bantu. */
function Judul({ p }: { p: ProductDetail }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
          {p.name}
        </h1>
        <ChipStatus status={p.status} />
      </div>
      <p className="text-muted text-base">{kalimatStatus(p)}</p>
    </div>
  );
}

/** DESIGN-V3 §5 — kartu wawasan di rel kanan: angka uang terkunci,
    latar tint emerald 10%, angka emerald-teks. */
function KartuTerkunci({ p }: { p: ProductDetail }) {
  return (
    <div className="rounded-card border-garis bg-emerald/10 shadow-card border p-6">
      <p className="angka text-emerald-teks text-[34px] leading-[1.15] font-bold tracking-[-0.01em]">
        {rupiah(p.lockedValue)}
      </p>
      <p className="text-muted mt-1 text-[13px]">uang terkunci di rak</p>
    </div>
  );
}

/** FSD §11.1 — statistik barang; kolom kiri bersama grafik mingguan. */
function Statistik({ p }: { p: ProductDetail }) {
  return (
    <dl className="rounded-card border-garis bg-card shadow-card grid grid-cols-2 gap-4 border p-4 md:flex md:flex-col md:gap-2">
      <Baris label="Stok" nilai={`${p.stock} ${p.unit}`} />
      <Baris label="Harga beli terakhir" nilai={rupiah(p.lastCost)} />
      <Baris label="Harga jual" nilai={rupiah(p.sellPrice)} />
      <Baris label="Margin per unit" nilai={rupiah(p.sellPrice - p.lastCost)} />
      <Baris
        label="Terakhir laku"
        nilai={
          p.lastSaleDate
            ? `${tanggalPendek(p.lastSaleDate)} · ${p.daysSinceLastSale ?? 0} hari lalu`
            : "Belum pernah laku"
        }
      />
    </dl>
  );
}

function KotakPelengkap({
  p,
  onBatas,
}: {
  p: ProductDetail;
  onBatas: (n: number | null) => void;
}) {
  const [nilai, setNilai] = useState(
    p.complementaryMaxStock === null ? "" : String(p.complementaryMaxStock),
  );

  return (
    <div className="rounded-card border-garis bg-card space-y-2 border p-4">
      <p className="text-base">
        Barang pelengkap.
        {p.complementaryOverstock && p.complementaryThreshold !== null
          ? ` Stok ${p.stock}, kebutuhan ±60 hari ${p.complementaryThreshold}. Jangan kulakan dulu sampai stok tinggal ${p.complementaryThreshold}.`
          : ""}
      </p>
      <div>
        <label htmlFor="batas-stok" className="text-muted block text-[13px]">
          Batas stok sendiri (opsional)
        </label>
        <div className="flex gap-2">
          <input
            id="batas-stok"
            inputMode="numeric"
            value={nilai}
            onChange={(e) => setNilai(e.target.value.replace(/\D/g, ""))}
            className="rounded-btn border-garis min-h-11 w-24 border px-3"
          />
          <button
            type="button"
            onClick={() => onBatas(nilai.trim() === "" ? null : Number(nilai))}
            className={tombolGaris}
          >
            Simpan batas
          </button>
        </div>
      </div>
    </div>
  );
}

function AksiBarang({
  p,
  onPerbaiki,
  onPelengkap,
  onArsip,
}: {
  p: ProductDetail;
  onPerbaiki: () => void;
  onPelengkap: () => void;
  onArsip: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/toko/barang/${p.id}/ubah`} className={tombolGaris}>
        Ubah
      </Link>
      <button type="button" onClick={onPerbaiki} className={tombolGaris}>
        Perbaiki stok
      </button>
      <button type="button" onClick={onPelengkap} className={tombolGaris}>
        {p.isComplementary ? "Batalkan pelengkap" : "Tandai pelengkap"}
      </button>
      <button type="button" onClick={onArsip} className={tombolGaris}>
        {p.archived ? "Pulihkan" : "Arsipkan"}
      </button>
    </div>
  );
}

function KonfirmasiArsip({
  arsip,
  onYa,
  onBatal,
}: {
  arsip: boolean;
  onYa: () => void;
  onBatal: () => void;
}) {
  return (
    <div className="rounded-card border-navy bg-card space-y-2 border p-4">
      <p className="text-base">
        Barang tidak muncul lagi di rekap &amp; beranda. Riwayat tetap
        tersimpan.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onYa} className={tombolUtama}>
          Ya, {arsip ? "pulihkan" : "arsipkan"}
        </button>
        <button type="button" onClick={onBatal} className={tombolGaris}>
          Batal
        </button>
      </div>
    </div>
  );
}

/** FSD §11.1 — aksi barang, kotak pelengkap, dan konfirmasi arsip. */
function BagianAksi({
  p,
  aksi,
  jalan,
  onPerbaiki,
}: {
  p: ProductDetail;
  aksi: ReturnType<typeof useAksiDetail>;
  jalan: Jalan;
  onPerbaiki: () => void;
}) {
  const [tanya, setTanya] = useState(false);

  return (
    <div className="space-y-2">
      <AksiBarang
        p={p}
        onPerbaiki={onPerbaiki}
        onPelengkap={() => jalan(() => aksi.pelengkap(!p.isComplementary))}
        onArsip={() => setTanya(true)}
      />
      {p.isComplementary ? (
        <KotakPelengkap p={p} onBatas={(n) => jalan(() => aksi.batasStok(n))} />
      ) : null}
      {tanya ? (
        <KonfirmasiArsip
          arsip={p.archived}
          onYa={() => {
            setTanya(false);
            jalan(() => aksi.arsipkan(!p.archived));
          }}
          onBatal={() => setTanya(false)}
        />
      ) : null}
    </div>
  );
}

function Kerangka({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-6">{children}</div>
    </AppShell>
  );
}

/**
 * DESIGN-V3 §5 — md/lg dua kolom: statistik + grafik di kiri, kartu uang
 * terkunci + aksi di rel kanan (360px pada lg). HP bertumpuk satu kolom.
 */
function KolomDetail({
  p,
  aksi,
  jalan,
  onPerbaiki,
}: {
  p: ProductDetail;
  aksi: ReturnType<typeof useAksiDetail>;
  jalan: Jalan;
  onPerbaiki: () => void;
}) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Statistik p={p} />
        <WeekChart weekQty={p.weekQty} />
      </div>
      <div className="space-y-6">
        <KartuTerkunci p={p} />
        <BagianAksi p={p} aksi={aksi} jalan={jalan} onPerbaiki={onPerbaiki} />
      </div>
    </div>
  );
}

type PropsIsi = {
  p: ProductDetail;
  rencana: ReturnType<typeof useRencana>;
  aksi: ReturnType<typeof useAksiDetail>;
  aksiRencana: ReturnType<typeof useAksiRencana>;
  aksiTahap: ReturnType<typeof useAksiTahap>;
};

function IsiDetail({ p, rencana, aksi, aksiRencana, aksiTahap }: PropsIsi) {
  const [pesan, setPesan] = useState("");
  const [sheet, setSheet] = useState(false);
  const [bagikan, setBagikan] = useState<string | null>(null);
  const jalan: Jalan = (fn) => {
    void fn().then((gagal) => setPesan(gagal ?? ""));
  };

  return (
    <div className="space-y-6">
      <Link
        href="/toko/barang"
        className="text-navy inline-flex min-h-11 items-center gap-1 text-base font-semibold"
      >
        <ChevronLeft aria-hidden className="h-5 w-5" />
        Kembali
      </Link>
      <Judul p={p} />
      <KolomDetail
        p={p}
        aksi={aksi}
        jalan={jalan}
        onPerbaiki={() => setSheet(true)}
      />
      {pesan ? (
        <p role="alert" className="text-danger text-base font-semibold">
          {pesan}
        </p>
      ) : null}
      <section id="rencana" className="space-y-4">
        <h2 className="text-[19px] font-semibold">Rencana</h2>
        <BagianRencana
          produk={p}
          plan={rencana.plan}
          lastEnded={rencana.lastEnded}
          memuat={rencana.memuat}
          aksi={{ ...aksiRencana, ...aksiTahap }}
          onBagikan={setBagikan}
        />
      </section>
      {sheet ? (
        <SheetStok
          nama={p.name}
          stok={p.stock}
          onBatal={() => setSheet(false)}
          onSimpan={(n) => {
            setSheet(false);
            jalan(() => aksi.perbaikiStok(n));
          }}
        />
      ) : null}
      {bagikan !== null ? (
        <ShareWA teks={bagikan} onTutup={() => setBagikan(null)} />
      ) : null}
    </div>
  );
}

export default function DetailBarangPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const produk = useProduk(id);
  const rencana = useRencana(id);

  const { muat: muatProduk } = produk;
  const { muat: muatRencana } = rencana;
  const segarkan = useCallback(async () => {
    await muatProduk();
    await muatRencana();
  }, [muatProduk, muatRencana]);

  const aksi = useAksiDetail(id ?? "", segarkan);
  const aksiRencana = useAksiRencana(id ?? "", segarkan);
  const aksiTahap = useAksiTahap(segarkan);

  if (produk.memuat && !produk.data) {
    return (
      <Kerangka>
        <p className="text-muted text-base">Memuat…</p>
      </Kerangka>
    );
  }

  if (produk.gagal || !produk.data) {
    return (
      <Kerangka>
        <div className="rounded-card border-garis bg-card border p-4">
          <p className="text-navy font-semibold">Barang tidak ditemukan.</p>
          <Link href="/toko/barang" className={`${tombolUtama} mt-4`}>
            Kembali ke daftar
          </Link>
        </div>
      </Kerangka>
    );
  }

  return (
    <>
      <Head>
        <title>{produk.data.name} — Lakoo</title>
      </Head>
      <Kerangka>
        <IsiDetail
          p={produk.data}
          rencana={rencana}
          aksi={aksi}
          aksiRencana={aksiRencana}
          aksiTahap={aksiTahap}
        />
      </Kerangka>
    </>
  );
}
