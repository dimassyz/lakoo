import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { FormBarang } from "@/components/FormBarang";
import { AppShell } from "@/components/NavBar";
import { useProduk } from "@/lib/detailBarang";
import { isianDari } from "@/lib/formBarang";

function Kerangka({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[560px] space-y-6 lg:max-w-[880px]">
        {children}
      </div>
    </AppShell>
  );
}

/** FSD §10 — ubah barang: harga beli & stok tidak ada di sini. */
export default function UbahBarangPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const produk = useProduk(id);

  if (produk.memuat && !produk.data) {
    return (
      <Kerangka>
        <p className="text-muted">Memuat…</p>
      </Kerangka>
    );
  }

  if (!produk.data) {
    return (
      <Kerangka>
        <div className="rounded-card border-line border p-4">
          <p className="font-semibold">Barang tidak ditemukan.</p>
          <Link
            href="/toko/barang"
            className="rounded-btn bg-marigold text-navy focus-visible:outline-navy mt-3 inline-flex h-[52px] cursor-pointer items-center justify-center px-4 font-semibold transition duration-150 hover:bg-[#d9932b] hover:shadow-[0_2px_8px_rgb(10_37_64/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
          >
            Kembali ke daftar
          </Link>
        </div>
      </Kerangka>
    );
  }

  const p = produk.data;

  return (
    <>
      <Head>
        <title>Ubah {p.name} — Lakoo</title>
      </Head>
      <Kerangka>
        <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
          Ubah barang
        </h1>
        <p className="text-muted -mt-4">{p.name}</p>
        <div className="bg-card rounded-card border-line shadow-card border p-4 md:p-6">
          <FormBarang
            mode="ubah"
            id={p.id}
            awal={isianDari(p)}
            onSelesai={() => void router.push(`/toko/barang/${p.id}`)}
          />
        </div>
      </Kerangka>
    </>
  );
}
