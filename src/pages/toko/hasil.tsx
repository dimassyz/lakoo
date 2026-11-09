import Head from "next/head";
import Link from "next/link";
import { GagalMuat } from "@/components/GagalMuat";
import { AppShell } from "@/components/NavBar";
import type { Plan, Results } from "@/lib/api";
import { labelRencana, useHasil } from "@/lib/rencanaHasil";
import { rupiah, tanggalPendek } from "@/lib/ui";

function Hero({ data }: { data: Results }) {
  return (
    <section className="rounded-card shadow-card space-y-2 border border-transparent bg-[#0b4a32] p-5 md:col-span-2 md:p-6 lg:col-span-1">
      <p className="text-marigold font-bold">Kas pulih dari rencana</p>
      <p className="angka text-[40px] leading-[1.1] font-bold text-white md:text-[48px]">
        {rupiah(data.totalRecovered)}
      </p>
      <p className="angka text-[#bcd8cb]">
        {rupiah(data.recovered30d)} dalam 30 hari terakhir
      </p>
      <p className="text-[13px] text-[#bcd8cb]">
        {data.activeCount} rencana berjalan · {data.finishedCount} selesai
      </p>
    </section>
  );
}

function Ringkasan({ data }: { data: Results }) {
  const minggu = data.latestWeeklySummary;
  if (!minggu) return null;

  return (
    <section className="rounded-card border-line shadow-card space-y-2 border bg-[#f3e9d7] p-5 md:p-6 lg:col-start-1">
      <h2 className="text-xl font-extrabold">
        Minggu {tanggalPendek(minggu.weekStart)}–{tanggalPendek(minggu.weekEnd)}
      </h2>
      {minggu.sentences.map((kalimat) => (
        <p key={kalimat}>{kalimat}</p>
      ))}
    </section>
  );
}

function BarisRencana({ plan }: { plan: Plan }) {
  return (
    <li className="rounded-card border-line shadow-card space-y-2 border bg-white p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/toko/barang/${plan.productId}#rencana`}
          className="hover:text-marigold-kuat focus-visible:outline-navy font-semibold underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {plan.productName}
        </Link>
        <p className="text-muted text-[13px]">{labelRencana(plan.state)}</p>
      </div>
      <p className="angka">
        {rupiah(plan.recovered)} dari {rupiah(plan.lockedValueAtStart ?? 0)}
      </p>
      <div className="h-2 w-full rounded-full bg-[#EDE9E2]">
        <div
          className="bg-sehat h-2 rounded-full"
          style={{ width: `${Math.min(100, plan.recoveredPercent)}%` }}
        />
      </div>
    </li>
  );
}

function Daftar({ plans }: { plans: Plan[] }) {
  return (
    <section className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <h2 className="text-xl font-extrabold">Per rencana</h2>
      <ul className="space-y-4">
        {plans.map((plan) => (
          <BarisRencana key={plan.id} plan={plan} />
        ))}
      </ul>
    </section>
  );
}

function Kosong() {
  return (
    <div className="rounded-card border-garis bg-card shadow-card space-y-4 border p-6">
      <p>
        Belum ada hasil. Jalankan satu rencana dulu — hasilnya muncul di sini.
      </p>
      <Link
        href="/toko/rencana"
        className="rounded-btn focus-visible:outline-navy bg-marigold text-navy hover:bg-marigold-hover hover:shadow-card disabled:hover:bg-marigold inline-flex h-[52px] cursor-pointer items-center justify-center px-4 font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-none"
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
  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (gagal || !data) {
    return <GagalMuat muat={onMuat} />;
  }

  if (data.plans.length === 0) return <Kosong />;

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
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
        <div className="space-y-6">
          <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
            Hasil
          </h1>
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
