import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { PenLine } from "lucide-react";
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
        className="rounded-card border-line focus-visible:outline-navy block h-full cursor-pointer space-y-2 border bg-white p-5 transition duration-150 hover:bg-[#F3EFE7] focus-visible:outline-2 focus-visible:outline-offset-2 md:p-6"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-bold">{plan.productName}</p>
          <p className="text-muted text-[13px]">{labelRencana(plan.state)}</p>
        </div>
        <p>
          {plan.currentStep ?? 0}/3{tahap ? ` · ${tahap.title}` : ""}
        </p>
        {tahap?.dueOn ? (
          <p
            className={
              tempo
                ? "text-danger text-sm font-bold"
                : "text-muted text-sm font-bold"
            }
          >
            cek {tanggalPendek(tahap.dueOn)}
          </p>
        ) : null}
        <div className="mt-1 h-2 w-full rounded-full bg-[#EDE9E2]">
          <div
            className="bg-emerald h-2 rounded-full"
            style={{ width: `${Math.min(100, plan.recoveredPercent)}%` }}
          />
        </div>
        <p className="angka text-muted text-[13px]">
          {rupiah(plan.recovered)} pulih · {plan.recoveredPercent}%
        </p>
      </Link>
    </li>
  );
}

/** DESIGN-V3 §5 — band Playbook AI di atas daftar rencana berjalan. */
function BandAI({ jumlah }: { jumlah: number }) {
  return (
    <div className="rounded-card flex items-start gap-3 bg-[#0b4a32] p-4">
      <PenLine
        size={20}
        strokeWidth={1.75}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[#bcd8cb]"
      />
      <div>
        <p className="font-semibold text-white">
          Playbook AI · disusun dari pola penjualan tokomu
        </p>
        {jumlah > 0 ? (
          <p className="text-[13px] text-[#bcd8cb]">
            {jumlah} rencana berjalan
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PilihanTab({ tab, onPilih }: { tab: Tab; onPilih: (t: Tab) => void }) {
  const dasar =
    "rounded-btn inline-flex min-h-11 cursor-pointer items-center border px-5 text-[15px] font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy active:translate-y-px";
  return (
    <div className="flex gap-3">
      <button
        type="button"
        aria-pressed={tab === "berjalan"}
        onClick={() => onPilih("berjalan")}
        className={`${dasar} ${tab === "berjalan" ? "border-navy text-navy" : "border-line hover:border-slate hover:text-navy"}`}
      >
        Berjalan
      </button>
      <button
        type="button"
        aria-pressed={tab === "riwayat"}
        onClick={() => onPilih("riwayat")}
        className={`${dasar} ${tab === "riwayat" ? "border-navy text-navy" : "border-line hover:border-slate hover:text-navy"}`}
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
  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (gagal) {
    return (
      <div className="rounded-card border-line border p-4">
        <p className="font-semibold">
          Gagal memuat. Periksa sinyal lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={onMuat}
          className="rounded-btn focus-visible:outline-navy bg-marigold text-navy hover:bg-marigold-hover hover:shadow-card disabled:hover:bg-marigold mt-3 inline-flex h-[52px] cursor-pointer items-center justify-center px-4 font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-none"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (items.length === 0)
    return (
      <div className="rounded-card border-garis bg-card shadow-card border p-6">
        <p>{kosong}</p>
      </div>
    );

  return (
    <ul className="mx-auto max-w-[640px] space-y-4 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-4 lg:space-y-0">
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
        <div className="space-y-6">
          <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
            Rencana
          </h1>
          {tab === "berjalan" ? <BandAI jumlah={daftar.items.length} /> : null}
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
