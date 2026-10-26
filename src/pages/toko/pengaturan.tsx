import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Keluar } from "@/components/NavBar";
import { api, type Me, type Store, type StorePatch } from "@/lib/api";
import {
  adaGalat,
  BAWAAN,
  dariStore,
  galatDariServer,
  JENIS,
  PELANGGAN,
  periksaAturan,
  type Galat,
  type Isian,
} from "@/lib/pengaturan";
import { useAntrean, type Antrean } from "@/lib/worker";

const kartu = "rounded-card border-muted space-y-3 border p-4";
const label = "block text-[15px] font-semibold";
const input =
  "rounded-card border-muted mt-1 w-full border px-3 py-2 text-[17px]";
const tombolSimpan =
  "rounded-card bg-safe px-4 py-3 text-[16px] font-semibold text-white disabled:opacity-60";
const tombolBiasa =
  "rounded-card border-muted border px-3 py-2 text-[15px] font-semibold";

/** FSD §15 — satu PATCH untuk profil + aturan + AI (semua field opsional). */
function bodySimpan(isi: Isian): StorePatch {
  return {
    name: isi.nama.trim(),
    storeType: isi.jenis === "" ? null : isi.jenis,
    location: isi.lokasi.trim() === "" ? null : isi.lokasi.trim(),
    customerTypes: isi.pelanggan,
    healthyDays: Number(isi.sehat),
    deadDays: Number(isi.mati),
    warningWeeks: Number(isi.waspada),
    aiEnabled: isi.ai,
  };
}

function Galat({ pesan }: { pesan?: string }) {
  if (!pesan) return null;
  return (
    <p role="alert" className="text-danger text-[13px] font-semibold">
      {pesan}
    </p>
  );
}

function IsianTeks({
  id,
  teks,
  nilai,
  galat,
  maks,
  onUbah,
}: {
  id: string;
  teks: string;
  nilai: string;
  galat?: string;
  maks: number;
  onUbah: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {teks}
      </label>
      <input
        id={id}
        value={nilai}
        maxLength={maks}
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? `${id}-galat` : undefined}
        onChange={(e) => onUbah(e.target.value)}
        className={input}
      />
      {galat ? (
        <span id={`${id}-galat`}>
          <Galat pesan={galat} />
        </span>
      ) : null}
    </div>
  );
}

function IsianAngka({
  id,
  teks,
  nilai,
  galat,
  onUbah,
}: {
  id: string;
  teks: string;
  nilai: string;
  galat?: string;
  onUbah: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {teks}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={nilai}
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? `${id}-galat` : undefined}
        onChange={(e) => onUbah(e.target.value)}
        className={input}
      />
      {galat ? (
        <span id={`${id}-galat`}>
          <Galat pesan={galat} />
        </span>
      ) : null}
    </div>
  );
}

function PilihJenis({
  nilai,
  onUbah,
}: {
  nilai: Isian["jenis"];
  onUbah: (v: Isian["jenis"]) => void;
}) {
  return (
    <div>
      <label htmlFor="jenis" className={label}>
        Jenis toko
      </label>
      <select
        id="jenis"
        value={nilai}
        onChange={(e) => onUbah(e.target.value as Isian["jenis"])}
        className={input}
      >
        <option value="">Belum dipilih</option>
        {JENIS.map((j) => (
          <option key={j.nilai} value={j.nilai}>
            {j.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PilihPelanggan({
  dipilih,
  galat,
  onUbah,
}: {
  dipilih: Isian["pelanggan"];
  galat?: string;
  onUbah: (v: Isian["pelanggan"]) => void;
}) {
  return (
    <fieldset>
      <legend className={label}>Tipe pelanggan</legend>
      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PELANGGAN.map((p) => (
          <label key={p.nilai} className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={dipilih.includes(p.nilai)}
              onChange={() =>
                onUbah(
                  dipilih.includes(p.nilai)
                    ? dipilih.filter((x) => x !== p.nilai)
                    : [...dipilih, p.nilai],
                )
              }
              className="h-5 w-5"
            />
            {p.label}
          </label>
        ))}
      </div>
      <Galat pesan={galat} />
    </fieldset>
  );
}

function Profil({
  isi,
  galat,
  onUbah,
}: {
  isi: Isian;
  galat: Galat;
  onUbah: (ubah: Partial<Isian>) => void;
}) {
  return (
    <section className={kartu}>
      <h2 className="text-[17px] font-semibold">Profil toko</h2>
      <IsianTeks
        id="nama"
        teks="Nama toko"
        nilai={isi.nama}
        galat={galat.nama}
        maks={60}
        onUbah={(v) => onUbah({ nama: v })}
      />
      <PilihJenis nilai={isi.jenis} onUbah={(v) => onUbah({ jenis: v })} />
      <IsianTeks
        id="lokasi"
        teks="Lokasi"
        nilai={isi.lokasi}
        maks={80}
        onUbah={(v) => onUbah({ lokasi: v })}
      />
      <PilihPelanggan
        dipilih={isi.pelanggan}
        galat={galat.pelanggan}
        onUbah={(v) => onUbah({ pelanggan: v })}
      />
    </section>
  );
}

function Aturan({
  isi,
  galat,
  onUbah,
}: {
  isi: Isian;
  galat: Galat;
  onUbah: (ubah: Partial<Isian>) => void;
}) {
  return (
    <section className={kartu}>
      <h2 className="text-[17px] font-semibold">Aturan status</h2>
      <IsianAngka
        id="sehat"
        teks={`Sehat bila laku dalam ${isi.sehat || "…"} hari`}
        nilai={isi.sehat}
        galat={galat.sehat}
        onUbah={(v) => onUbah({ sehat: v })}
      />
      <IsianAngka
        id="mati"
        teks={`Mati bila tidak laku lebih dari ${isi.mati || "…"} hari`}
        nilai={isi.mati}
        galat={galat.mati}
        onUbah={(v) => onUbah({ mati: v })}
      />
      <IsianAngka
        id="waspada"
        teks={`Waspada bila turun ${isi.waspada || "…"} minggu berturut-turut`}
        nilai={isi.waspada}
        galat={galat.waspada}
        onUbah={(v) => onUbah({ waspada: v })}
      />
      <p className="text-muted text-[13px]">
        Bawaan: {BAWAAN.healthyDays} hari, {BAWAAN.deadDays} hari,{" "}
        {BAWAAN.warningWeeks} minggu.
      </p>
    </section>
  );
}

function SaranAI({
  ai,
  onUbah,
}: {
  ai: boolean;
  onUbah: (v: boolean) => void;
}) {
  return (
    <section className={kartu}>
      <h2 className="text-[17px] font-semibold">Saran AI</h2>
      <label className="flex items-center gap-2 text-[15px]">
        <input
          type="checkbox"
          checked={ai}
          onChange={(e) => onUbah(e.target.checked)}
          className="h-5 w-5"
        />
        Gunakan AI untuk menyusun saran
      </label>
      <p className="text-muted text-[13px]">
        Bila mati, Lakoo memakai saran dasar.
      </p>
    </section>
  );
}

/** FSD §15 — PATCH /store untuk simpan dan untuk `resetThresholds`. */
function useForm(me: Me, onMe: (store: Store) => void) {
  const [isi, setIsi] = useState<Isian>(() => dariStore(me.store));
  const [galat, setGalat] = useState<Galat>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const ubah = useCallback((ubah: Partial<Isian>) => {
    setIsi((lama) => ({ ...lama, ...ubah }));
    setPesan(null);
  }, []);

  async function kirim(body: StorePatch, berhasil: string) {
    setMenyimpan(true);
    setGalat({});
    const res = await api.PATCH("/store", { body }).catch(() => null);
    setMenyimpan(false);

    if (res?.response.ok && res.data) {
      onMe(res.data);
      setIsi(dariStore(res.data));
      setPesan(berhasil);
      return;
    }
    setGalat(galatDariServer(res?.response.status ?? 0, res?.error));
  }

  async function simpan() {
    const lokal = periksaAturan(isi);
    if (adaGalat(lokal)) {
      setGalat(lokal);
      setPesan(null);
      return;
    }
    await kirim(bodySimpan(isi), "Tersimpan.");
  }

  return {
    isi,
    galat,
    pesan,
    menyimpan,
    ubah,
    simpan,
    bawaan: () => kirim({ resetThresholds: true }, "Ambang kembali ke bawaan."),
  };
}

function Aksi({ form }: { form: ReturnType<typeof useForm> }) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void form.simpan()}
          disabled={form.menyimpan}
          className={tombolSimpan}
        >
          {form.menyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        <button
          type="button"
          onClick={() => void form.bawaan()}
          disabled={form.menyimpan}
          className={tombolBiasa}
        >
          Kembalikan ke bawaan
        </button>
      </div>
      {form.pesan ? (
        <p role="status" className="text-safe text-[15px] font-semibold">
          {form.pesan}
        </p>
      ) : null}
      <Galat pesan={form.galat.umum} />
    </>
  );
}

function Akun({ me, antrean }: { me: Me; antrean: Antrean }) {
  return (
    <section className={kartu}>
      <h2 className="text-[17px] font-semibold">Akun</h2>
      <p className="text-[15px]">
        {me.user.isDemo ? "Akun demo" : (me.user.email ?? "—")}
      </p>
      <Keluar antrean={antrean} />
    </section>
  );
}

function Isi({
  me,
  onMe,
  antrean,
}: {
  me: Me;
  onMe: (store: Store) => void;
  antrean: Antrean;
}) {
  const form = useForm(me, onMe);
  return (
    <div className="space-y-3">
      <Profil isi={form.isi} galat={form.galat} onUbah={form.ubah} />
      <Aturan isi={form.isi} galat={form.galat} onUbah={form.ubah} />
      <SaranAI ai={form.isi.ai} onUbah={(v) => form.ubah({ ai: v })} />
      <Aksi form={form} />
      <Akun me={me} antrean={antrean} />
    </div>
  );
}

/** FSD §15 — pengaturan toko, aturan status, saran AI, akun. */
export default function PengaturanPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);
  const antrean = useAntrean();

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const res = await api.GET("/me").catch(() => null);
    if (res?.response.ok && res.data) setMe(res.data);
    else setGagal(true);
    setMemuat(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <>
      <Head>
        <title>Pengaturan — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Pengaturan</h1>
          {memuat ? <p className="text-muted text-[15px]">Memuat…</p> : null}
          {!memuat && gagal ? (
            <div className="rounded-card border-muted border p-4">
              <p className="font-semibold">
                Gagal memuat pengaturan. Periksa sinyal lalu coba lagi.
              </p>
              <button
                type="button"
                onClick={() => void muat()}
                className={`${tombolSimpan} mt-3`}
              >
                Coba lagi
              </button>
            </div>
          ) : null}
          {!memuat && !gagal && me ? (
            <Isi
              me={me}
              antrean={antrean}
              onMe={(store) =>
                setMe((lama) => (lama ? { ...lama, store } : lama))
              }
            />
          ) : null}
        </div>
      </AppShell>
    </>
  );
}
