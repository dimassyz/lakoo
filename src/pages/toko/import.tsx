import Head from "next/head";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { api, type ImportResult } from "@/lib/api";
import {
  csvBermasalah,
  csvKeTabel,
  dariTabelBarang,
  dariTabelJual,
  type BarisBarang,
  type BarisJual,
} from "@/lib/importData";

type Jenis = "barang" | "jual";
type Mode = "preview" | "commit";
type Duplikat = "skip" | "update_price";
type Baris = BarisBarang | BarisJual;

const MAKS_BYTE = 2 * 1024 * 1024;

const kartu = "rounded-card border-muted space-y-3 border p-4";
const tombolUtama =
  "rounded-card bg-safe px-4 py-3 text-[16px] font-semibold text-white disabled:opacity-60";
const tombolBiasa =
  "rounded-card border-muted border px-3 py-2 text-[15px] font-semibold";
const tautanUnduh = "text-safe text-[15px] font-semibold underline";

const TEMPLATE: Record<Jenis, { label: string; href: string }[]> = {
  barang: [
    { label: "Template CSV", href: "/templates/barang.csv" },
    { label: "Template XLSX", href: "/templates/barang.xlsx" },
  ],
  jual: [{ label: "Template CSV", href: "/templates/penjualan.csv" }],
};

const KETERANGAN: Record<Jenis, string> = {
  barang:
    "Kolom: nama_barang, harga_beli, harga_jual, stok, satuan, kategori. Maks 500 baris.",
  jual: "Kolom: tanggal, nama_barang, jumlah. Tanggal boleh YYYY-MM-DD atau DD/MM/YYYY. Maks 5.000 baris.",
};

function pesanStatus(status: number): string {
  if (status === 401) return "Sesi berakhir, silakan masuk lagi";
  if (status === 403) return "Akun demo tidak bisa import";
  if (status === 413) return "File terlalu besar. Maksimal 2 MB.";
  if (status === 429) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  return "Gagal memproses file. Coba lagi sebentar.";
}

/** FSD §14.5 — CSV dibuat di browser, tidak lewat server. */
function unduh(nama: string, isi: string) {
  const url = URL.createObjectURL(
    new Blob([isi], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV dibaca sebagai teks; XLSX lewat library yang sudah terpasang. */
async function bacaTabel(berkas: File): Promise<unknown[][]> {
  if (!berkas.name.toLowerCase().endsWith(".xlsx"))
    return csvKeTabel(await berkas.text());
  // v9 tidak punya entry root; build browser ada di subpath ini. `readSheet`
  // (bukan default) mengembalikan baris satu sheet, bukan daftar sheet.
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(berkas)) as unknown[][];
}

type Siap = { ok: true; rows: Baris[] } | { ok: false; pesan: string };

/** FSD §14.2–14.3 — batas 2 MB, header dicocokkan, baris kosong dibuang. */
async function siapkan(jenis: Jenis, berkas: File): Promise<Siap> {
  if (berkas.size > MAKS_BYTE)
    return { ok: false, pesan: "File terlalu besar. Maksimal 2 MB." };

  const tabel = await bacaTabel(berkas);
  const parsed =
    jenis === "barang" ? dariTabelBarang(tabel) : dariTabelJual(tabel);
  if (!parsed.ok) return { ok: false, pesan: parsed.pesan };
  if (parsed.rows.length === 0)
    return { ok: false, pesan: "File tidak berisi baris data." };
  return { ok: true, rows: parsed.rows };
}

async function kirimKe(
  jenis: Jenis,
  mode: Mode,
  duplikat: Duplikat,
  rows: Baris[],
) {
  const res =
    jenis === "barang"
      ? await api
          .POST("/imports/products", {
            body: { mode, onDuplicate: duplikat, rows: rows as BarisBarang[] },
          })
          .catch(() => null)
      : await api
          .POST("/imports/sales", { body: { mode, rows: rows as BarisJual[] } })
          .catch(() => null);

  return res?.response.ok && res.data
    ? { ok: true as const, hasil: res.data }
    : { ok: false as const, pesan: pesanStatus(res?.response.status ?? 0) };
}

function useImport(jenis: Jenis) {
  const [duplikat, setDuplikat] = useState<Duplikat>("skip");
  const [rows, setRows] = useState<Baris[]>([]);
  const [hasil, setHasil] = useState<ImportResult | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  async function kirim(mode: Mode, dikirim: Baris[], dup: Duplikat = duplikat) {
    setMemuat(true);
    setPesan(null);
    const r = await kirimKe(jenis, mode, dup, dikirim);
    setMemuat(false);
    if (!r.ok) {
      setPesan(r.pesan);
      return;
    }
    setHasil(r.hasil);
    setSelesai(mode === "commit");
  }

  /** FSD §14.3 — pilihan duplikat mengubah angka "sudah ada", jadi preview diulang. */
  async function ubahDuplikat(d: Duplikat) {
    setDuplikat(d);
    if (rows.length > 0) await kirim("preview", rows, d);
  }

  async function pilih(berkas: File) {
    setPesan(null);
    setHasil(null);
    setSelesai(false);
    const siap = await siapkan(jenis, berkas);
    if (!siap.ok) {
      setPesan(siap.pesan);
      return;
    }
    setRows(siap.rows);
    await kirim("preview", siap.rows);
  }

  return {
    duplikat,
    ubahDuplikat,
    rows,
    hasil,
    selesai,
    pesan,
    memuat,
    pilih,
    kirim,
    ulang: () => {
      setHasil(null);
      setSelesai(false);
      setRows([]);
    },
  };
}

function Templat({ jenis }: { jenis: Jenis }) {
  return (
    <div className={kartu}>
      <p className="text-[15px] font-semibold">1. Unduh template</p>
      <div className="flex flex-wrap gap-3">
        {TEMPLATE[jenis].map((t) => (
          <a key={t.href} href={t.href} download className={tautanUnduh}>
            {t.label}
          </a>
        ))}
      </div>
      <p className="text-muted text-[13px]">{KETERANGAN[jenis]}</p>
    </div>
  );
}

function PilihBerkas({
  jenis,
  onPilih,
}: {
  jenis: Jenis;
  onPilih: (f: File) => void;
}) {
  const id = `berkas-${jenis}`;
  return (
    <div className={kartu}>
      <label htmlFor={id} className="text-[15px] font-semibold">
        {`2. Pilih file ${jenis === "barang" ? "(.csv atau .xlsx" : "(.csv"}, maks 2 MB)`}
      </label>
      <input
        id={id}
        type="file"
        accept={jenis === "barang" ? ".csv,.xlsx" : ".csv"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPilih(f);
        }}
        className="text-[15px]"
      />
    </div>
  );
}

function RadioDuplikat({
  nilai,
  onUbah,
}: {
  nilai: Duplikat;
  onUbah: (v: Duplikat) => void;
}) {
  const pilihan: { nilai: Duplikat; label: string }[] = [
    { nilai: "skip", label: "Lewati" },
    { nilai: "update_price", label: "Perbarui harga" },
  ];
  return (
    <fieldset className={kartu}>
      <legend className="text-[15px] font-semibold">
        Bila nama barang sudah ada
      </legend>
      {pilihan.map((p) => (
        <label key={p.nilai} className="flex items-center gap-2 text-[15px]">
          <input
            type="radio"
            name="duplikat"
            checked={nilai === p.nilai}
            onChange={() => onUbah(p.nilai)}
            className="h-5 w-5"
          />
          {p.label}
        </label>
      ))}
    </fieldset>
  );
}

function TabelBermasalah({
  invalid,
  onUnduh,
}: {
  invalid: ImportResult["invalidRows"];
  onUnduh: () => void;
}) {
  return (
    <>
      <table className="w-full text-left">
        <caption className="sr-only">Baris bermasalah dan alasannya</caption>
        <thead>
          <tr className="text-muted text-[13px]">
            <th scope="col" className="py-1">
              Baris
            </th>
            <th scope="col" className="py-1">
              Alasan
            </th>
          </tr>
        </thead>
        <tbody>
          {invalid.map((r) => (
            <tr key={`${r.index}-${r.code}`}>
              <td className="py-1">{r.index + 2}</td>
              <td className="py-1">{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={tautanUnduh} onClick={onUnduh}>
        Unduh baris bermasalah
      </button>
    </>
  );
}

function HasilImport({
  hasil,
  baris,
  selesai,
}: {
  hasil: ImportResult;
  baris: Baris[];
  selesai: boolean;
}) {
  return (
    <div className={`${kartu} text-[15px]`}>
      <p className="font-semibold">
        {selesai
          ? `Selesai: ${hasil.created} dibuat, ${hasil.updated} diperbarui, ${hasil.skipped} dilewati`
          : `${hasil.validRows} baris siap, ${hasil.invalidRows.length} baris bermasalah, ${hasil.skipped} sudah ada`}
      </p>

      {hasil.invalidRows.length > 0 ? (
        <TabelBermasalah
          invalid={hasil.invalidRows}
          onUnduh={() =>
            unduh(
              "baris-bermasalah.csv",
              csvBermasalah(
                baris as unknown as Record<string, unknown>[],
                hasil.invalidRows,
              ),
            )
          }
        />
      ) : null}
    </div>
  );
}

function IsiTab({ jenis, aktif }: { jenis: Jenis; aktif: boolean }) {
  const imp = useImport(jenis);
  if (!aktif) return null;

  return (
    <div className="space-y-3">
      <Templat jenis={jenis} />
      <PilihBerkas jenis={jenis} onPilih={(f) => void imp.pilih(f)} />
      {jenis === "barang" ? (
        <RadioDuplikat
          nilai={imp.duplikat}
          onUbah={(d) => void imp.ubahDuplikat(d)}
        />
      ) : null}

      {imp.memuat ? <p className="text-muted text-[15px]">Memproses…</p> : null}
      {imp.pesan ? (
        <p role="alert" className="text-danger text-[15px] font-semibold">
          {imp.pesan}
        </p>
      ) : null}

      {imp.hasil ? (
        <HasilImport hasil={imp.hasil} baris={imp.rows} selesai={imp.selesai} />
      ) : null}

      {imp.hasil && !imp.selesai && imp.hasil.validRows > 0 ? (
        <button
          type="button"
          onClick={() => void imp.kirim("commit", imp.rows)}
          disabled={imp.memuat}
          className={tombolUtama}
        >
          Simpan {imp.hasil.validRows} baris
        </button>
      ) : null}

      {imp.selesai ? (
        <button type="button" onClick={imp.ulang} className={tombolBiasa}>
          Import file lain
        </button>
      ) : null}
    </div>
  );
}

function PilihanTab({
  jenis,
  onPilih,
}: {
  jenis: Jenis;
  onPilih: (j: Jenis) => void;
}) {
  const dasar = "rounded-card border px-3 py-2 text-[15px] font-semibold";
  const tab: { nilai: Jenis; label: string }[] = [
    { nilai: "barang", label: "Daftar barang" },
    { nilai: "jual", label: "Penjualan" },
  ];
  return (
    <div className="flex gap-2">
      {tab.map((t) => (
        <button
          key={t.nilai}
          type="button"
          aria-pressed={jenis === t.nilai}
          onClick={() => onPilih(t.nilai)}
          className={`${dasar} ${jenis === t.nilai ? "border-safe text-safe" : "border-muted"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** FSD §14 — dua tab: daftar barang dan penjualan. */
export default function ImportPage() {
  const [jenis, setJenis] = useState<Jenis>("barang");

  return (
    <>
      <Head>
        <title>Import — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Import</h1>
          <PilihanTab jenis={jenis} onPilih={setJenis} />
          <IsiTab jenis="barang" aktif={jenis === "barang"} />
          <IsiTab jenis="jual" aktif={jenis === "jual"} />
        </div>
      </AppShell>
    </>
  );
}
