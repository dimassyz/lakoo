import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { BarisNota, BarisRiwayat } from "@/components/BarisMasuk";
import { NotaTempel } from "@/components/NotaTempel";
import {
  kelompokRiwayat,
  useLayarMasuk,
  type LayarMasuk,
} from "@/lib/barangMasuk";
import { batasTanggal, rupiah } from "@/lib/ui";

const tombolUtama =
  "rounded-card bg-safe px-4 py-3 font-semibold text-white disabled:opacity-40";
const tombolGaris = "rounded-card border-muted border px-4 py-3 font-semibold";

/** FSD §8 — tanggal nota: bawaan hari ini, boleh mundur sampai 365 hari. */
function KepalaNota({ l, onTempel }: { l: LayarMasuk; onTempel: () => void }) {
  const { min, max } = batasTanggal();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Barang Masuk</h1>
      <div>
        <label htmlFor="tanggal-nota" className="text-muted block text-[13px]">
          Tanggal nota
        </label>
        <input
          id="tanggal-nota"
          type="date"
          value={l.form.tanggal}
          min={min}
          max={max}
          onChange={(e) => l.form.setTanggal(e.target.value)}
          className="rounded-card border-muted border px-3 py-2"
        />
      </div>
      <button type="button" onClick={onTempel} className={tombolGaris}>
        Tempel dari nota
      </button>
      {l.toast ? (
        <p
          role="status"
          className="rounded-card border-muted border p-2 text-[15px]"
        >
          {l.toast}
        </p>
      ) : null}
      {l.produk.gagal ? (
        <p className="text-[15px]">
          Gagal memuat daftar barang. Saran nama tidak tersedia.
        </p>
      ) : null}
      {!l.produk.memuat && l.produk.items.length === 0 ? (
        <p className="text-[15px]">
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
    <div className="space-y-2">
      <ul className="space-y-2">
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
    <div className="rounded-card border-muted bg-surface sticky bottom-16 z-10 border p-3 lg:bottom-0">
      <p className="text-muted text-[15px]">
        {l.angka.baris} baris · {rupiah(l.angka.total)}
      </p>
      {kurang > 0 ? (
        <p role="alert" className="text-[15px] font-semibold">
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
    return <p className="text-muted text-[15px]">Memuat…</p>;
  }

  if (l.riwayat.gagal) {
    return (
      <div className="rounded-card border-muted border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => void l.riwayat.muat()}
          className="rounded-card bg-safe mt-3 px-4 py-3 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (l.riwayat.items.length === 0) {
    return (
      <p className="text-muted text-[15px]">
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
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Riwayat 30 hari</h2>
      <IsiRiwayat l={l} />
    </section>
  );
}

export default function BarangMasukPage() {
  const l = useLayarMasuk();
  const [tempel, setTempel] = useState(false);

  return (
    <>
      <Head>
        <title>Barang Masuk — Lakoo</title>
      </Head>
      <AppShell>
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
          <FooterNota l={l} />
          <RiwayatMasuk l={l} />
        </div>
      </AppShell>
    </>
  );
}
