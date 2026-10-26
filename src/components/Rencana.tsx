import { useEffect, useState } from "react";
import type { Plan, PlanStep, ProductDetail } from "@/lib/api";
import { useAksiRencana, useAksiTahap } from "@/lib/detailBarang";
import { rupiah, tanggalPendek } from "@/lib/ui";

type Aksi = ReturnType<typeof useAksiRencana> & ReturnType<typeof useAksiTahap>;

const tombolGaris = "rounded-card border-muted border px-4 py-3 font-semibold";
const tombolUtama =
  "rounded-card bg-safe px-4 py-3 font-semibold text-white disabled:opacity-40";

const TANDA: Record<PlanStep["outcome"], string> = {
  succeeded: "✓",
  failed: "✗",
  skipped: "–",
  pending: "",
  in_progress: "",
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
        <dd className="text-ink font-semibold">
          {rupiah(s.oldPrice)} → {rupiah(s.newPrice)}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Per unit</dt>
        <dd
          className={
            s.isLoss ? "text-danger font-semibold" : "text-safe font-semibold"
          }
        >
          {s.isLoss
            ? `Rugi ${rupiah(Math.abs(s.profitPerUnit))} per unit`
            : `Untung ${rupiah(s.profitPerUnit)}/unit`}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>Bila stok habis terjual</dt>
        <dd>±{rupiah(s.cashBackEstimate)} kembali</dd>
      </div>
      {s.bundleProduct ? (
        <div className="flex justify-between gap-2">
          <dt>Paket</dt>
          <dd>
            {s.bundleProduct.name} · {rupiah(s.bundlePrice ?? 0)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function KartuTahap({ s, redup }: { s: PlanStep; redup?: boolean }) {
  return (
    <li
      className={`rounded-card border-muted border p-3 ${redup ? "opacity-60" : ""}`}
    >
      <p className="text-muted text-[13px] font-semibold">
        {TANDA[s.outcome]} Tahap {s.stepNo} · {s.durationDays} hari
      </p>
      <p className="font-semibold">{s.title}</p>
      <p className="text-[15px]">{s.instructions}</p>
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
    <div className="rounded-card border-ink space-y-2 border p-3">
      <p className="text-[15px]">{pesan}</p>
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
    <div className="space-y-2">
      <p className="text-muted text-[13px] font-semibold">
        {plan.source === "ai" ? "Disusun AI" : "Saran dasar"}
      </p>
      <p className="text-[15px]">{plan.rationale}</p>
      <ol className="space-y-2">
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
    <div className="rounded-card border-safe space-y-2 border p-3">
      <p className="text-muted text-[13px] font-semibold">
        Sedang berjalan · Tahap {s.stepNo} · {s.durationDays} hari
      </p>
      <p className="font-semibold">{s.title}</p>
      <p className="text-[15px]">{s.instructions}</p>
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
    <div>
      <p className="font-semibold">
        {rupiah(plan.recovered)} dari {rupiah(plan.lockedValueAtStart ?? 0)}{" "}
        kembali
      </p>
      <div className="bg-muted/30 mt-1 h-2 w-full rounded-full">
        <div
          className="bg-safe h-2 rounded-full"
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
      <ol className="space-y-2">
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
          className="text-[15px] underline"
        >
          Hentikan rencana
        </button>
      )}
    </div>
  );
}

function SelesaiRencana({ plan, onBaru }: { plan: Plan; onBaru: () => void }) {
  return (
    <div className="rounded-card border-muted space-y-2 border p-3">
      <p className="text-[15px]">
        {pesanAkhir(plan)} {rupiah(plan.recovered)} kembali.
      </p>
      <button type="button" onClick={onBaru} className={tombolGaris}>
        Buat rencana baru
      </button>
    </div>
  );
}

function TeksBergilir() {
  const [i, setI] = useState(0);
  const teks = ["Membaca riwayat penjualan…", "Menyusun langkah…"];

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % teks.length), 2500);
    return () => clearInterval(t);
  }, [teks.length]);

  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-muted text-[15px]">{teks[i]}</p>
      {[1, 2, 3].map((n) => (
        <div key={n} className="rounded-card border-muted h-20 border" />
      ))}
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
        <p role="alert" className="text-danger text-[15px] font-semibold">
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
      return <p className="text-muted text-[15px]">Memuat…</p>;
    case "pelengkap":
      return (
        <p className="text-[15px]">
          Barang pelengkap tidak diberi saran obral.
        </p>
      );
    case "sehat":
      return (
        <p className="text-[15px]">
          Barang ini sehat.
          {produk.daysUntilEmpty !== null
            ? ` ±${produk.daysUntilEmpty} hari lagi habis.`
            : ""}
        </p>
      );
    case "membuat":
      return <TeksBergilir />;
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
