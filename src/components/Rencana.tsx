import { useState } from "react";
import { CircleCheck, CircleX, Minus, type LucideIcon } from "lucide-react";
import type { Plan, PlanStep, ProductDetail } from "@/lib/api";
import { useAksiRencana, useAksiTahap } from "@/lib/detailBarang";
import { rupiah, tanggalPendek } from "@/lib/ui";

type Aksi = ReturnType<typeof useAksiRencana> & ReturnType<typeof useAksiTahap>;

/* Palet v6 + affordance (mock.css .btn-ghost/.btn-primary): ghost hover
   border slate + teks ink; utama marigold solid teks ink, hover #D9932B,
   nonaktif pudar tanpa hover. */
const tombolGaris =
  "rounded-btn border-line inline-flex h-[52px] cursor-pointer items-center justify-center border px-4 font-semibold transition duration-150 hover:border-slate hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";
const tombolUtama =
  "rounded-btn inline-flex h-[52px] cursor-pointer items-center justify-center bg-[#E8A33D] px-4 font-semibold text-navy transition duration-150 hover:bg-[#D9932B] focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-[#E8A33D]";

/** Ikon outcome tahap — Lucide, emoji render beda per OS. */
const TANDA: Record<PlanStep["outcome"], LucideIcon | null> = {
  succeeded: CircleCheck,
  failed: CircleX,
  skipped: Minus,
  pending: null,
  in_progress: null,
};

const AKHIR: Record<string, string> = {
  completed: "Rencana selesai di tahap {n}.",
  sold_out: "Stok habis terjual!",
  exhausted: "3 tahap sudah dicoba. Pertimbangkan berhenti kulakan barang ini.",
  stopped: "Rencana dihentikan.",
};

function pesanAkhir(plan: Plan): string {
  return (AKHIR[plan.state] ?? "Rencana berakhir.").replace(
    "{n}",
    String(plan.currentStep ?? plan.steps.length),
  );
}

/** FSD §11.2 — kotak hitungan tiap tahap. */
function KotakHitungan({ s }: { s: PlanStep }) {
  return (
    <dl className="text-muted mt-2 space-y-1 text-[13px]">
      <div className="flex justify-between gap-2">
        <dt>Harga</dt>
        <dd className="angka text-ink font-semibold">
          {rupiah(s.oldPrice)} → {rupiah(s.newPrice)}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Per unit</dt>
        <dd
          className={
            s.isLoss
              ? "angka text-danger font-semibold"
              : "angka text-emerald-teks font-semibold"
          }
        >
          {s.isLoss
            ? `Rugi ${rupiah(Math.abs(s.profitPerUnit))} per unit`
            : `Untung ${rupiah(s.profitPerUnit)}/unit`}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Bila stok habis terjual</dt>
        <dd className="angka text-emerald-teks font-semibold">
          ±{rupiah(s.cashBackEstimate)} kembali
        </dd>
      </div>
      {s.bundleProduct ? (
        <div className="flex justify-between gap-2">
          <dt>Paket</dt>
          <dd className="angka">
            {s.bundleProduct.name} · {rupiah(s.bundlePrice ?? 0)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function KartuTahap({ s, redup }: { s: PlanStep; redup?: boolean }) {
  const Ikon = TANDA[s.outcome];

  return (
    <li
      className={`rounded-card border-line shadow-card border bg-white p-4 ${redup ? "opacity-60" : ""}`}
    >
      <p className="text-muted flex items-center gap-2 text-[13px] font-semibold">
        {Ikon ? <Ikon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        Tahap {s.stepNo} · {s.durationDays} hari
      </p>
      <p className="text-[17px] font-semibold">{s.title}</p>
      <p>{s.instructions}</p>
      <p className="text-muted text-[13px]">
        Berhasil kalau: {s.successCriteria}
      </p>
      <KotakHitungan s={s} />
    </li>
  );
}

/** Konfirmasi dua tombol, tanpa dialog bawaan browser. */
function Konfirmasi({
  pesan,
  onYa,
  onBatal,
}: {
  pesan: string;
  onYa: () => void;
  onBatal: () => void;
}) {
  return (
    <div className="rounded-card border-ink space-y-2 border p-4">
      <p>{pesan}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onYa} className={tombolUtama}>
          Ya
        </button>
        <button type="button" onClick={onBatal} className={tombolGaris}>
          Batal
        </button>
      </div>
    </div>
  );
}

function SaranRencana({
  plan,
  onJalankan,
  onBuatUlang,
}: {
  plan: Plan;
  onJalankan: () => void;
  onBuatUlang: () => void;
}) {
  const [tanyaUlang, setTanyaUlang] = useState(false);

  return (
    <div className="space-y-4">
      <p>
        <span className="rounded-pill border-line inline-block border px-2 py-0.5 text-[13px] font-semibold">
          {plan.source === "ai" ? "Saran AI" : "Saran dasar"}
        </span>
      </p>
      <p>{plan.rationale}</p>
      <ol className="space-y-4">
        {plan.steps.map((s) => (
          <KartuTahap key={s.stepNo} s={s} />
        ))}
      </ol>
      {tanyaUlang ? (
        <Konfirmasi
          pesan="Saran sekarang akan diganti."
          onYa={() => {
            setTanyaUlang(false);
            onBuatUlang();
          }}
          onBatal={() => setTanyaUlang(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onJalankan} className={tombolUtama}>
            Jalankan rencana ini
          </button>
          <button
            type="button"
            onClick={() => setTanyaUlang(true)}
            className={tombolGaris}
          >
            Buat ulang saran
          </button>
        </div>
      )}
      <p className="text-muted text-[13px]">Ini saran, kamu yang memutuskan.</p>
    </div>
  );
}

type PropsTahap = {
  s: PlanStep;
  total: number;
  hargaSekarang: number;
  onTerapkanHarga: () => void;
  onBagikan: (teks: string) => void;
  onHasil: (h: "succeeded" | "failed") => void;
};

function TombolTahap({
  s,
  hargaSekarang,
  onTerapkanHarga,
  onBagikan,
}: Pick<PropsTahap, "s" | "hargaSekarang" | "onTerapkanHarga" | "onBagikan">) {
  if (s.newPrice === hargaSekarang && !s.shareText) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {s.newPrice !== hargaSekarang ? (
        <button type="button" onClick={onTerapkanHarga} className={tombolGaris}>
          Ubah harga jual jadi {rupiah(s.newPrice)}
        </button>
      ) : null}
      {s.shareText ? (
        <button
          type="button"
          onClick={() => onBagikan(s.shareText ?? "")}
          className={tombolGaris}
        >
          Bagikan ke WhatsApp
        </button>
      ) : null}
    </div>
  );
}

/** FSD §11.2 state C — tahap yang sedang berjalan, disorot. */
function TombolHasil({
  akhir,
  stepNo,
  onTanya,
}: {
  akhir: boolean;
  stepNo: number;
  onTanya: (t: "berhasil" | "belum") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onTanya("berhasil")}
        className={tombolUtama}
      >
        Berhasil
      </button>
      <button
        type="button"
        onClick={() => onTanya("belum")}
        className={tombolGaris}
      >
        {akhir
          ? "Belum berhasil — akhiri"
          : `Belum berhasil — lanjut tahap ${stepNo + 1}`}
      </button>
    </div>
  );
}

function IsiTahapBerjalan({
  s,
  akhir,
  hargaSekarang,
  onTerapkanHarga,
  onBagikan,
  onTanya,
}: PropsTahap & {
  akhir: boolean;
  onTanya: (t: "berhasil" | "belum") => void;
}) {
  return (
    <div className="rounded-card border-emerald space-y-2 border bg-white p-4">
      <p className="text-muted text-[13px] font-semibold">
        Sedang berjalan · Tahap {s.stepNo} · {s.durationDays} hari
      </p>
      <p className="text-[17px] font-semibold">{s.title}</p>
      <p>{s.instructions}</p>
      <p className="text-muted text-[13px]">
        Mulai {s.startedOn ? tanggalPendek(s.startedOn) : "–"} · cek{" "}
        {s.dueOn ? tanggalPendek(s.dueOn) : "–"}
      </p>
      <KotakHitungan s={s} />
      <TombolTahap
        s={s}
        hargaSekarang={hargaSekarang}
        onTerapkanHarga={onTerapkanHarga}
        onBagikan={onBagikan}
      />
      <TombolHasil akhir={akhir} stepNo={s.stepNo} onTanya={onTanya} />
    </div>
  );
}

function TahapBerjalan(props: PropsTahap) {
  const { s, total, onHasil } = props;
  const [tanya, setTanya] = useState<"berhasil" | "belum" | null>(null);
  const akhir = s.stepNo >= total;

  if (tanya) {
    const pesan =
      tanya === "berhasil"
        ? "Tandai tahap ini berhasil?"
        : akhir
          ? "Tandai belum berhasil dan akhiri rencana?"
          : `Tandai belum berhasil dan lanjut tahap ${s.stepNo + 1}?`;
    return (
      <Konfirmasi
        pesan={pesan}
        onYa={() => {
          onHasil(tanya === "berhasil" ? "succeeded" : "failed");
          setTanya(null);
        }}
        onBatal={() => setTanya(null)}
      />
    );
  }

  return <IsiTahapBerjalan {...props} akhir={akhir} onTanya={setTanya} />;
}

/** FSD §11.2 state C — kas pulih dan bar progres. */
function KasPulih({ plan }: { plan: Plan }) {
  return (
    <div className="rounded-card border-line shadow-card border bg-white p-4">
      <p className="angka font-semibold">
        {rupiah(plan.recovered)} dari {rupiah(plan.lockedValueAtStart ?? 0)}{" "}
        kembali
      </p>
      <div className="bg-muted/30 mt-1 h-2 w-full rounded-full">
        <div
          className="bg-emerald h-2 rounded-full"
          style={{ width: `${Math.min(100, plan.recoveredPercent)}%` }}
        />
      </div>
      <p className="text-muted text-[13px]">{plan.recoveredPercent}%</p>
    </div>
  );
}

type PropsAktif = {
  plan: Plan;
  produk: ProductDetail;
  onTerapkanHarga: (stepNo: number) => void;
  onBagikan: (teks: string) => void;
  onHasil: (stepNo: number, h: "succeeded" | "failed") => void;
  onHentikan: () => void;
};

/** FSD §11.2 state C. */
function AktifRencana({
  plan,
  produk,
  onTerapkanHarga,
  onBagikan,
  onHasil,
  onHentikan,
}: PropsAktif) {
  const [tanyaStop, setTanyaStop] = useState(false);

  return (
    <div className="space-y-2">
      <KasPulih plan={plan} />
      <ol className="space-y-4">
        {plan.steps.map((s) =>
          s.outcome === "in_progress" ? (
            <li key={s.stepNo}>
              <TahapBerjalan
                s={s}
                total={plan.steps.length}
                hargaSekarang={produk.sellPrice}
                onTerapkanHarga={() => onTerapkanHarga(s.stepNo)}
                onBagikan={onBagikan}
                onHasil={(h) => onHasil(s.stepNo, h)}
              />
            </li>
          ) : (
            <KartuTahap key={s.stepNo} s={s} redup={s.outcome === "pending"} />
          ),
        )}
      </ol>
      {tanyaStop ? (
        <Konfirmasi
          pesan="Hentikan rencana ini?"
          onYa={() => {
            setTanyaStop(false);
            onHentikan();
          }}
          onBatal={() => setTanyaStop(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setTanyaStop(true)}
          className="hover:text-navy focus-visible:outline-navy cursor-pointer underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Hentikan rencana
        </button>
      )}
    </div>
  );
}

function SelesaiRencana({ plan, onBaru }: { plan: Plan; onBaru: () => void }) {
  return (
    <div className="rounded-card border-line shadow-card space-y-2 border bg-white p-4">
      <p className="angka">
        {pesanAkhir(plan)} {rupiah(plan.recovered)} kembali.
      </p>
      <button type="button" onClick={onBaru} className={tombolGaris}>
        Buat rencana baru
      </button>
    </div>
  );
}

type Jenis =
  | "memuat"
  | "pelengkap"
  | "sehat"
  | "membuat"
  | "kosong"
  | "suggested"
  | "active"
  | "selesai";

function jenisRencana(
  produk: ProductDetail,
  plan: Plan | null,
  memuat: boolean,
  membuat: boolean,
): Jenis {
  if (memuat) return "memuat";
  if (produk.isComplementary) return "pelengkap";
  if (produk.status === "sehat") return "sehat";
  if (membuat) return "membuat";
  if (!plan) return "kosong";
  if (plan.state === "suggested") return "suggested";
  if (plan.state === "active") return "active";
  return "selesai";
}

function TombolBuat({ pesan, onBuat }: { pesan: string; onBuat: () => void }) {
  return (
    <div className="space-y-2">
      <button type="button" onClick={onBuat} className={tombolUtama}>
        Buat rencana
      </button>
      {pesan ? (
        <p role="alert" className="text-danger font-semibold">
          {pesan}
        </p>
      ) : null}
    </div>
  );
}

type PropsTanpaRencana = {
  jenis: Jenis;
  produk: ProductDetail;
  pesan: string;
  onBuat: (regenerate: boolean) => void;
};

function IsiTanpaRencana({ jenis, produk, pesan, onBuat }: PropsTanpaRencana) {
  switch (jenis) {
    case "memuat":
      return <p className="text-muted">Memuat…</p>;
    case "pelengkap":
      return (
        <div className="rounded-card border-line shadow-card border bg-white p-4">
          <p>Barang pelengkap tidak diberi saran obral.</p>
        </div>
      );
    case "sehat":
      return (
        <div className="rounded-card border-line shadow-card border bg-white p-4">
          <p>
            Barang ini sehat.
            {produk.daysUntilEmpty !== null
              ? ` ±${produk.daysUntilEmpty} hari lagi habis.`
              : ""}
          </p>
        </div>
      );
    case "membuat":
      return <p className="text-muted">Memuat…</p>;
    default:
      return <TombolBuat pesan={pesan} onBuat={() => onBuat(false)} />;
  }
}

function BlokSelesai({
  plan,
  lastEnded,
  onBuat,
}: {
  plan: Plan;
  lastEnded: Plan | null;
  onBuat: () => void;
}) {
  return (
    <div className="space-y-2">
      <SelesaiRencana plan={plan} onBaru={onBuat} />
      {lastEnded ? (
        <p className="text-muted text-[13px]">
          Sebelumnya: {pesanAkhir(lastEnded)} {rupiah(lastEnded.recovered)}{" "}
          kembali.
        </p>
      ) : null}
    </div>
  );
}

type PropsDenganRencana = {
  plan: Plan;
  produk: ProductDetail;
  lastEnded: Plan | null;
  aksi: Aksi;
  onBagikan: (teks: string) => void;
  onBuat: (regenerate: boolean) => void;
};

function IsiDenganRencana({
  plan,
  produk,
  lastEnded,
  aksi,
  onBagikan,
  onBuat,
}: PropsDenganRencana) {
  if (plan.state === "suggested") {
    return (
      <SaranRencana
        plan={plan}
        onJalankan={() => void aksi.jalankanRencana(plan.id)}
        onBuatUlang={() => onBuat(true)}
      />
    );
  }

  if (plan.state === "active") {
    return (
      <AktifRencana
        plan={plan}
        produk={produk}
        onTerapkanHarga={(stepNo) => void aksi.terapkanHarga(plan.id, stepNo)}
        onBagikan={onBagikan}
        onHasil={(stepNo, h) => void aksi.hasil(plan.id, stepNo, h)}
        onHentikan={() => void aksi.hentikan(plan.id)}
      />
    );
  }

  return (
    <BlokSelesai
      plan={plan}
      lastEnded={lastEnded}
      onBuat={() => onBuat(false)}
    />
  );
}

type Props = {
  produk: ProductDetail;
  plan: Plan | null;
  lastEnded: Plan | null;
  memuat: boolean;
  aksi: Aksi;
  onBagikan: (teks: string) => void;
};

/** FSD §11.2 — memilih state A/B/C/D sesuai status barang dan rencana. */
export function BagianRencana({
  produk,
  plan,
  lastEnded,
  memuat,
  aksi,
  onBagikan,
}: Props) {
  const [membuat, setMembuat] = useState(false);
  const [pesan, setPesan] = useState("");
  const jenis = jenisRencana(produk, plan, memuat, membuat);

  async function buat(regenerate: boolean) {
    setMembuat(true);
    setPesan("");
    const gagal = await aksi.buat(regenerate);
    if (gagal) setPesan(gagal);
    setMembuat(false);
  }

  const punyaRencana =
    jenis === "suggested" || jenis === "active" || jenis === "selesai";

  if (punyaRencana && plan) {
    return (
      <IsiDenganRencana
        plan={plan}
        produk={produk}
        lastEnded={lastEnded}
        aksi={aksi}
        onBagikan={onBagikan}
        onBuat={(r) => void buat(r)}
      />
    );
  }

  return (
    <IsiTanpaRencana
      jenis={jenis}
      produk={produk}
      pesan={pesan}
      onBuat={(r) => void buat(r)}
    />
  );
}
