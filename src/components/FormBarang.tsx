import Link from "next/link";
import {
  peringatanJual,
  useFormBarang,
  type GalatBarang,
  type IsianBarang,
} from "@/lib/formBarang";

const tombolUtama =
  "rounded-card bg-safe px-4 py-3 font-semibold text-white disabled:opacity-40";
const tombolGaris = "rounded-card border-muted border px-4 py-3 font-semibold";
const kotakIsian = "rounded-card border-muted w-full border px-3 py-2";
const teksError = "text-danger text-[13px] font-semibold";

type Ubah = (patch: Partial<IsianBarang>) => void;

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-muted block text-[13px]">
      {children}
    </label>
  );
}

function Galat({ pesan, tautan }: { pesan?: string; tautan?: string }) {
  if (!pesan) return null;
  return (
    <p role="alert" className={teksError}>
      {pesan}
      {tautan ? (
        <>
          {" "}
          <Link href={tautan} className="underline">
            Buka barangnya
          </Link>
        </>
      ) : null}
    </p>
  );
}

function IsianTeks({
  id,
  label,
  nilai,
  galat,
  tautan,
  onUbah,
  fokus,
}: {
  id: string;
  label: string;
  nilai: string;
  galat?: string;
  tautan?: string;
  onUbah: (v: string) => void;
  fokus?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        value={nilai}
        autoFocus={fokus}
        onChange={(e) => onUbah(e.target.value)}
        aria-invalid={galat ? true : undefined}
        className={kotakIsian}
      />
      <Galat pesan={galat} tautan={tautan} />
    </div>
  );
}

function IsianAngka({
  id,
  label,
  nilai,
  galat,
  onUbah,
  bantuan,
}: {
  id: string;
  label: string;
  nilai: string;
  galat?: string;
  onUbah: (v: string) => void;
  bantuan?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        inputMode="numeric"
        value={nilai}
        onChange={(e) => onUbah(e.target.value.replace(/\D/g, ""))}
        aria-invalid={galat ? true : undefined}
        className={kotakIsian}
      />
      {bantuan ? <p className="text-muted text-[13px]">{bantuan}</p> : null}
      <Galat pesan={galat} />
    </div>
  );
}

function IsianUtama({
  isian,
  galat,
  tautan,
  peringatan,
  baru,
  onUbah,
}: {
  isian: IsianBarang;
  galat: GalatBarang;
  tautan?: string;
  peringatan: string;
  baru: boolean;
  onUbah: Ubah;
}) {
  return (
    <div className="space-y-3">
      <IsianTeks
        id="nama"
        label="Nama barang"
        nilai={isian.nama}
        galat={galat.nama}
        tautan={tautan}
        onUbah={(v) => onUbah({ nama: v })}
        fokus
      />

      {baru ? (
        <IsianAngka
          id="modal"
          label="Harga beli (Rp)"
          nilai={isian.modal}
          galat={galat.modal}
          onUbah={(v) => onUbah({ modal: v })}
        />
      ) : null}

      <IsianAngka
        id="jual"
        label="Harga jual (Rp)"
        nilai={isian.jual}
        galat={galat.jual}
        onUbah={(v) => onUbah({ jual: v })}
      />
      {peringatan ? (
        <p className="text-warn text-[15px] font-semibold">{peringatan}</p>
      ) : null}

      {baru ? (
        <IsianAngka
          id="stok"
          label="Stok sekarang"
          nilai={isian.stok}
          galat={galat.stok}
          onUbah={(v) => onUbah({ stok: v })}
        />
      ) : null}
    </div>
  );
}

function DetailLain({
  isian,
  galat,
  baru,
  onUbah,
}: {
  isian: IsianBarang;
  galat: GalatBarang;
  baru: boolean;
  onUbah: Ubah;
}) {
  return (
    <details className="rounded-card border-muted border p-3">
      <summary className="cursor-pointer text-[15px] font-semibold">
        Detail lain
      </summary>
      <div className="mt-3 space-y-3">
        <IsianTeks
          id="satuan"
          label="Satuan"
          nilai={isian.satuan}
          galat={galat.satuan}
          onUbah={(v) => onUbah({ satuan: v })}
        />
        <IsianTeks
          id="kategori"
          label="Kategori"
          nilai={isian.kategori}
          galat={galat.kategori}
          onUbah={(v) => onUbah({ kategori: v })}
        />
        <div>
          <label className="flex items-start gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={isian.pelengkap}
              onChange={(e) => onUbah({ pelengkap: e.target.checked })}
              className="mt-1"
            />
            <span>Barang pelengkap</span>
          </label>
          <p className="text-muted text-[13px]">
            Pelengkap tidak dihitung sebagai barang yang perlu diobral.
          </p>
        </div>
        {!baru && isian.pelengkap ? (
          <IsianAngka
            id="batas-stok"
            label="Batas stok sendiri (opsional)"
            nilai={isian.batasStok}
            galat={galat.batasStok}
            onUbah={(v) => onUbah({ batasStok: v })}
            bantuan="Kosongkan untuk memakai hitungan otomatis."
          />
        ) : null}
      </div>
    </details>
  );
}

function TombolSimpan({
  menyimpan,
  baru,
  onKirim,
}: {
  menyimpan: boolean;
  baru: boolean;
  onKirim: (lagi: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={menyimpan}
        onClick={() => onKirim(false)}
        className={tombolUtama}
      >
        {menyimpan ? "Menyimpan…" : "Simpan"}
      </button>
      {baru ? (
        <button
          type="button"
          disabled={menyimpan}
          onClick={() => onKirim(true)}
          className={tombolGaris}
        >
          Simpan &amp; tambah lagi
        </button>
      ) : null}
    </div>
  );
}

export function FormBarang({
  mode,
  awal,
  id,
  onSelesai,
}: {
  mode: "baru" | "ubah";
  awal?: IsianBarang;
  id?: string;
  onSelesai: (id: string) => void;
}) {
  const f = useFormBarang(mode, id, awal, onSelesai);
  const baru = mode === "baru";

  return (
    <div className="space-y-3">
      <IsianUtama
        isian={f.isian}
        galat={f.galat}
        tautan={f.tautan}
        peringatan={peringatanJual(f.isian)}
        baru={baru}
        onUbah={f.ubah}
      />
      <DetailLain isian={f.isian} galat={f.galat} baru={baru} onUbah={f.ubah} />
      {f.galat.umum ? (
        <p role="alert" className={`${teksError} text-[15px]`}>
          {f.galat.umum}
        </p>
      ) : null}
      <TombolSimpan
        menyimpan={f.menyimpan}
        baru={baru}
        onKirim={(lagi) => void f.kirim(lagi)}
      />
    </div>
  );
}
