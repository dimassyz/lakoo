import Head from "next/head";
import Link from "next/link";
import { AppShell } from "@/components/NavBar";
import type { Plan, Results } from "@/lib/api";
import { labelRencana, useHasil } from "@/lib/rencanaHasil";
import { rupiah, tanggalPendek } from "@/lib/ui";

function Hero({ data }: { data: Results }) {
  return (
    <section className="space-y-1">
      <p className="text-muted text-[15px]">Kas pulih dari rencana</p>
      <p className="text-4xl font-bold">{rupiah(data.totalRecovered)}</p>
      <p className="text-[15px]">
        {rupiah(data.recovered30d)} dalam 30 hari terakhir
      </p>
      <p className="text-muted text-[13px]">
        {data.activeCount} rencana berjalan · {data.finishedCount} selesai
      </p>
    </section>
  );
}

function Ringkasan({ data }: { data: Results }) {
  const minggu = data.latestWeeklySummary;
  if (!minggu) return null;

  return (
    <section className="rounded-card border-muted space-y-1 border p-3">
      <h2 className="text-lg font-semibold">
        Minggu {tanggalPendek(minggu.weekStart)}–{tanggalPendek(minggu.weekEnd)}
      </h2>
      {minggu.sentences.map((kalimat) => (
        <p key={kalimat} className="text-[15px]">
          {kalimat}
        </p>
      ))}
    </section>
  );
}

function BarisRencana({ plan }: { plan: Plan }) {
  return (
    <li className="rounded-card border-muted space-y-1 border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/toko/barang/${plan.productId}#rencana`}
          className="font-semibold underline"
        >
          {plan.productName}
        </Link>
        <p className="text-muted text-[13px]">{labelRencana(plan.state)}</p>
      </div>
      <p className="text-[15px]">
        {rupiah(plan.recovered)} dari {rupiah(plan.lockedValueAtStart ?? 0)}
      </p>
      <div className="bg-muted/30 h-2 w-full rounded-full">
        <div
          className="bg-safe h-2 rounded-full"
          style={{ width: `${Math.min(100, plan.recoveredPercent)}%` }}
        />
      </div>
    </li>
  );
}

function Daftar({ plans }: { plans: Plan[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Per rencana</h2>
      <ul className="space-y-2">
        {plans.map((plan) => (
          <BarisRencana key={plan.id} plan={plan} />
        ))}
      </ul>
    </section>
  );
}

function Kosong() {
  return (
    <div className="space-y-2">
      <p className="text-[15px]">
        Belum ada hasil. Jalankan satu rencana dulu — hasilnya muncul di sini.
      </p>
      <Link
        href="/toko/rencana"
        className="rounded-card bg-safe inline-block px-4 py-3 font-semibold text-white"
      >
        Lihat rencana
      </Link>
    </div>
  );
}

function Isi({
  data,
  memuat,
  gagal,
  onMuat,
}: {
  data: Results | null;
  memuat: boolean;
  gagal: boolean;
  onMuat: () => void;
}) {
  if (memuat) return <p className="text-muted text-[15px]">Memuat…</p>;

  if (gagal || !data) {
    return (
      <div className="rounded-card border-muted border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={onMuat}
          className="rounded-card bg-safe mt-3 px-4 py-3 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (data.plans.length === 0) return <Kosong />;

  return (
    <div className="space-y-4">
      <Hero data={data} />
      <Ringkasan data={data} />
      <Daftar plans={data.plans} />
    </div>
  );
}

/** FSD §13 — kas pulih, ringkasan mingguan, dan hasil per rencana. */
export default function HasilPage() {
  const hasil = useHasil();

  return (
    <>
      <Head>
        <title>Hasil — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Hasil</h1>
          <Isi
            data={hasil.data}
            memuat={hasil.memuat}
            gagal={hasil.gagal}
            onMuat={() => void hasil.muat()}
          />
        </div>
      </AppShell>
    </>
  );
}
