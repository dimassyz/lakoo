import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/NavBar";
import { BarisNota, BarisRiwayat } from "@/components/BarisMasuk";
import { NotaTempel } from "@/components/NotaTempel";
import {
  barisDariPayload,
  kelompokRiwayat,
  useLayarMasuk,
  type LayarMasuk,
} from "@/lib/barangMasuk";
import { batasTanggal, rupiah } from "@/lib/ui";
import { ambilItem } from "@/lib/worker";

/** FSD §0.4 — "Buka & perbaiki" memulihkan isian nota yang tertahan di antrean. */
function usePulihkanAntrean(l: LayarMasuk) {
  const router = useRouter();
  const id =
    typeof router.query.antrean === "string" ? router.query.antrean : undefined;
  const dipakai = useRef(false);

  useEffect(() => {
    if (!id || dipakai.current) return;
    dipakai.current = true;
    void ambilItem(id).then((it) => {
      if (it?.kind !== "stockin") return;
      l.form.setTanggal(it.payload.receivedOn);
      l.form.isi(barisDariPayload(it.payload, l.produk.items));
    });
  }, [id, l]);
}

const tombolUtama =
  "rounded-btn bg-navy inline-flex h-[52px] items-center justify-center px-4 font-semibold text-white disabled:opacity-40";
const tombolGaris =
  "rounded-btn border-line inline-flex h-[52px] items-center justify-center border px-4 font-semibold";

/** FSD §8 — tanggal nota: bawaan hari ini, boleh mundur sampai 365 hari. */
function KepalaNota({ l, onTempel }: { l: LayarMasuk; onTempel: () => void }) {
  const { min, max } = batasTanggal();

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
        Barang Masuk
      </h1>
      <div>
        <label
          htmlFor="tanggal-nota"
          className="text-muted block text-[13px] font-semibold"
        >
          Tanggal nota
        </label>
        <input
          id="tanggal-nota"
          type="date"
          value={l.form.tanggal}
          min={min}
          max={max}
          onChange={(e) => l.form.setTanggal(e.target.value)}
          className="rounded-btn border-line h-[52px] border px-3"
        />
      </div>
      <button type="button" onClick={onTempel} className={tombolGaris}>
        Tempel dari nota
      </button>
      {l.toast ? (
        <p role="status" className="rounded-card border-line border p-3">
          {l.toast}
        </p>
      ) : null}
      {l.produk.gagal ? (
        <p>Gagal memuat daftar barang. Saran nama tidak tersedia.</p>
      ) : null}
      {!l.produk.memuat && l.produk.items.length === 0 ? (
        <p>
          Belum ada barang.{" "}
          <Link href="/toko/barang" className="font-semibold underline">
            Tambah barang
          </Link>{" "}
          dulu, atau ketik nama baru di baris nota.
        </p>
      ) : null}
    </div>
  );
}

function DaftarNota({ l }: { l: LayarMasuk }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {l.form.daftar.map((b) => (
          <BarisNota
            key={b.kunci}
            baris={b}
            produk={l.produk.items}
            error={l.error[b.kunci]}
            bisaBuang={l.form.daftar.length > 1}
            onUbah={(baru) => l.form.ubah(b.kunci, baru)}
            onBuang={() => l.form.buang(b.kunci)}
          />
        ))}
      </ul>
      <button type="button" onClick={l.form.tambah} className={tombolGaris}>
        + Tambah baris
      </button>
    </div>
  );
}

function FooterNota({ l }: { l: LayarMasuk }) {
  const kurang = Object.keys(l.error).length;

  return (
    <div className="rounded-card border-line bg-surface sticky bottom-16 z-10 border p-4 md:top-6 md:bottom-auto">
      <p className="angka text-muted">
        {l.angka.baris} baris · {rupiah(l.angka.total)}
      </p>
      {kurang > 0 ? (
        <p role="alert" className="text-danger font-semibold">
          {kurang} baris perlu dicek
        </p>
      ) : null}
      <button
        type="button"
        disabled={!l.bisa}
        onClick={() => void l.simpan()}
        className={`mt-2 w-full ${l.bisa ? tombolUtama : tombolGaris}`}
      >
        {l.menyimpan ? "Menyimpan…" : "Simpan"}
      </button>
    </div>
  );
}

function IsiRiwayat({ l }: { l: LayarMasuk }) {
  if (l.riwayat.memuat) {
    return <p className="text-muted">Memuat…</p>;
  }

  if (l.riwayat.gagal) {
    return (
      <div className="rounded-card border-line border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => void l.riwayat.muat()}
          className="rounded-btn bg-navy mt-3 inline-flex h-[52px] items-center justify-center px-4 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (l.riwayat.items.length === 0) {
    return (
      <p className="text-muted">
        Belum ada barang masuk dalam 30 hari terakhir.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {kelompokRiwayat(l.riwayat.items).map((g) => (
        <section key={g.tanggal} className="space-y-2">
          <h3 className="text-muted text-[13px] font-semibold">{g.tanggal}</h3>
          <ul className="space-y-2">
            {g.baris.map((it) => (
              <BarisRiwayat
                key={it.id}
                item={it}
                onUbah={l.aksi.ubah}
                onHapus={l.aksi.hapus}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RiwayatMasuk({ l }: { l: LayarMasuk }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[19px] font-semibold">Riwayat 30 hari</h2>
      <IsiRiwayat l={l} />
    </section>
  );
}

export default function BarangMasukPage() {
  const l = useLayarMasuk();
  const [tempel, setTempel] = useState(false);
  usePulihkanAntrean(l);

  return (
    <>
      <Head>
        <title>Barang Masuk — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-6">
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <KepalaNota l={l} onTempel={() => setTempel(true)} />
              {tempel ? (
                <NotaTempel
                  produk={l.produk.items}
                  onIsi={(daftar) => {
                    l.form.isi(daftar);
                    setTempel(false);
                  }}
                  onTutup={() => setTempel(false)}
                />
              ) : null}
              <DaftarNota l={l} />
            </div>
            <FooterNota l={l} />
          </div>
          <RiwayatMasuk l={l} />
        </div>
      </AppShell>
    </>
  );
}
