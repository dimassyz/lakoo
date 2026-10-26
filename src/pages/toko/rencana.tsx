import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import type { Plan } from "@/lib/api";
import {
  labelRencana,
  lewatTempo,
  tahapSekarang,
  useDaftarRencana,
} from "@/lib/rencanaHasil";
import { rupiah, tanggalPendek } from "@/lib/ui";

type Tab = "berjalan" | "riwayat";

function Kartu({ plan }: { plan: Plan }) {
  const tahap = tahapSekarang(plan);
  const tempo = tahap?.dueOn ? lewatTempo(tahap.dueOn) : false;

  return (
    <li>
      <Link
        href={`/toko/barang/${plan.productId}#rencana`}
        className="rounded-card border-muted block space-y-1 border p-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">{plan.productName}</p>
          <p className="text-muted text-[13px]">{labelRencana(plan.state)}</p>
        </div>
        <p className="text-[15px]">
          {plan.currentStep ?? 0}/3{tahap ? ` · ${tahap.title}` : ""}
        </p>
        {tahap?.dueOn ? (
          <p
            className={
              tempo
                ? "text-danger text-[13px] font-semibold"
                : "text-muted text-[13px]"
            }
          >
            cek {tanggalPendek(tahap.dueOn)}
          </p>
        ) : null}
        <div className="bg-muted/30 mt-1 h-2 w-full rounded-full">
          <div
            className="bg-safe h-2 rounded-full"
            style={{ width: `${Math.min(100, plan.recoveredPercent)}%` }}
          />
        </div>
        <p className="text-muted text-[13px]">
          {rupiah(plan.recovered)} pulih · {plan.recoveredPercent}%
        </p>
      </Link>
    </li>
  );
}

function PilihanTab({ tab, onPilih }: { tab: Tab; onPilih: (t: Tab) => void }) {
  const dasar = "rounded-card border px-3 py-2 text-[15px] font-semibold";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={tab === "berjalan"}
        onClick={() => onPilih("berjalan")}
        className={`${dasar} ${tab === "berjalan" ? "border-safe text-safe" : "border-muted"}`}
      >
        Berjalan
      </button>
      <button
        type="button"
        aria-pressed={tab === "riwayat"}
        onClick={() => onPilih("riwayat")}
        className={`${dasar} ${tab === "riwayat" ? "border-safe text-safe" : "border-muted"}`}
      >
        Riwayat
      </button>
    </div>
  );
}

function Isi({
  items,
  memuat,
  gagal,
  kosong,
  onMuat,
}: {
  items: Plan[];
  memuat: boolean;
  gagal: boolean;
  kosong: string;
  onMuat: () => void;
}) {
  if (memuat) return <p className="text-muted text-[15px]">Memuat…</p>;

  if (gagal) {
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

  if (items.length === 0) return <p className="text-[15px]">{kosong}</p>;

  return (
    <ul className="space-y-2">
      {items.map((plan) => (
        <Kartu key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}

/** FSD §12 — dua tab: rencana berjalan dan riwayat. */
export default function RencanaPage() {
  const [tab, setTab] = useState<Tab>("berjalan");
  const daftar = useDaftarRencana(tab === "berjalan");

  return (
    <>
      <Head>
        <title>Rencana — Lakoo</title>
      </Head>
      <AppShell>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Rencana</h1>
          <PilihanTab tab={tab} onPilih={setTab} />
          <Isi
            items={daftar.items}
            memuat={daftar.memuat}
            gagal={daftar.gagal}
            onMuat={() => void daftar.muat()}
            kosong={
              tab === "berjalan"
                ? "Belum ada rencana berjalan. Pilih barang di Beranda → Tangani dulu."
                : "Belum ada riwayat rencana."
            }
          />
        </div>
      </AppShell>
    </>
  );
}
