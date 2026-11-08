import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/NavBar";
import { KpiHero, StatusTiles } from "@/components/KPIHero";
import {
  BerandaKosong,
  HariIni,
  PelengkapKebanyakan,
  RingkasanMinggu,
  SegeraKulakan,
  TanganiDulu,
  tanpaBarang,
} from "@/components/DashboardSections";
import { api, type Dashboard } from "@/lib/api";

function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data: hasil, error } = await api.GET("/dashboard");
    if (error) setGagal(true);
    else setData(hasil ?? null);
    setMemuat(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { data, memuat, gagal, muat };
}

/** FSD §6 — urutan blok HP: hero, ubin, hari ini, minggu lalu, tangani, kulakan, pelengkap. */
function Isi({ data }: { data: Dashboard }) {
  if (tanpaBarang(data.totals)) {
    return (
      <div className="space-y-6">
        <KpiHero totals={data.totals} />
        <BerandaKosong />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* DESIGN-V3 §5 — md: hero dan ubin berdampingan; lg: hero selebar
          halaman, ubin 4 sebaris di bawahnya (grid ubin di KPIHero). */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
        <KpiHero totals={data.totals} />
        <StatusTiles byStatus={data.totals.byStatus} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <TanganiDulu items={data.topPriority} />
          <HariIni today={data.today} />
        </div>
        <div className="space-y-6">
          <RingkasanMinggu summary={data.weeklySummary} />
          <SegeraKulakan items={data.restockSoon} />
          <PelengkapKebanyakan items={data.complementaryOverstock} />
        </div>
      </div>
    </div>
  );
}

function Kerangka() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="text-muted text-base">Memuat…</p>
      <div className="rounded-card border-garis bg-card h-28 border" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-card border-garis bg-card h-24 border" />
        <div className="rounded-card border-garis bg-card h-24 border" />
        <div className="rounded-card border-garis bg-card h-24 border" />
        <div className="rounded-card border-garis bg-card h-24 border" />
      </div>
    </div>
  );
}

function Gagal({ muat }: { muat: () => void }) {
  return (
    <div className="rounded-card border-garis bg-card border p-4">
      <p className="text-navy font-semibold">
        Gagal memuat. Periksa sinyal lalu coba lagi.
      </p>
      <button
        type="button"
        onClick={muat}
        className="rounded-btn bg-navy mt-4 inline-flex min-h-11 items-center px-4 font-semibold text-white"
      >
        Coba lagi
      </button>
    </div>
  );
}

export default function BerandaPage() {
  const { data, memuat, gagal, muat } = useDashboard();

  return (
    <>
      <Head>
        <title>Beranda — Lakoo</title>
      </Head>
      <AppShell store={data?.store}>
        {memuat ? <Kerangka /> : null}
        {!memuat && gagal ? <Gagal muat={() => void muat()} /> : null}
        {!memuat && !gagal && data ? <Isi data={data} /> : null}
      </AppShell>
      <Link
        href="/toko/rekap"
        className="rounded-btn bg-navy shadow-float fixed right-4 bottom-20 inline-flex min-h-11 items-center px-4 font-semibold text-white lg:hidden"
      >
        Rekap hari ini
      </Link>
    </>
  );
}
