import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
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
import { labelStatus, rupiah, tanggalPendek } from "@/lib/ui";

const tombolGaris =
  "rounded-card border-muted border px-3 py-2 text-[15px] font-semibold";
const tombolUtama =
  "rounded-card bg-safe px-3 py-2 text-[15px] font-semibold text-white";

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
    <div className="flex justify-between gap-2 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{nilai}</dd>
    </div>
  );
}

/** FSD §11.1 — ringkasan barang. */
function Ringkasan({ p }: { p: ProductDetail }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <p className="text-muted text-[13px]">{labelStatus(p.status)}</p>
      </div>
      <p className="text-muted text-[15px]">{kalimatStatus(p)}</p>
      <p className="text-3xl font-bold">{rupiah(p.lockedValue)}</p>
      <p className="text-muted text-[13px]">uang terkunci di rak</p>
      <dl className="rounded-card border-muted space-y-1 border p-3">
        <Baris label="Stok" nilai={`${p.stock} ${p.unit}`} />
        <Baris label="Harga beli terakhir" nilai={rupiah(p.lastCost)} />
        <Baris label="Harga jual" nilai={rupiah(p.sellPrice)} />
        <Baris
          label="Margin per unit"
          nilai={rupiah(p.sellPrice - p.lastCost)}
        />
        <Baris
          label="Terakhir laku"
          nilai={
            p.lastSaleDate
              ? `${tanggalPendek(p.lastSaleDate)} · ${p.daysSinceLastSale ?? 0} hari lalu`
              : "Belum pernah laku"
          }
        />
      </dl>
      <WeekChart weekQty={p.weekQty} />
    </div>
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
    <div className="rounded-card border-muted space-y-2 border p-3">
      <p className="text-[15px]">
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
            className="rounded-card border-muted w-24 border px-3 py-2"
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
    <div className="rounded-card border-ink space-y-2 border p-3">
      <p className="text-[15px]">
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
      <div className="space-y-3">{children}</div>
    </AppShell>
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
    <>
      <Ringkasan p={p} />
      <BagianAksi
        p={p}
        aksi={aksi}
        jalan={jalan}
        onPerbaiki={() => setSheet(true)}
      />
      {pesan ? (
        <p role="alert" className="text-danger text-[15px] font-semibold">
          {pesan}
        </p>
      ) : null}
      <section id="rencana" className="space-y-2">
        <h2 className="text-lg font-semibold">Rencana</h2>
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
    </>
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
        <p className="text-muted text-[15px]">Memuat…</p>
      </Kerangka>
    );
  }

  if (produk.gagal || !produk.data) {
    return (
      <Kerangka>
        <div className="rounded-card border-muted border p-4">
          <p className="font-semibold">Barang tidak ditemukan.</p>
          <Link
            href="/toko/barang"
            className={`${tombolUtama} mt-3 inline-block`}
          >
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
