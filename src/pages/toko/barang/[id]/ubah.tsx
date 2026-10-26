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
      <div className="space-y-3">{children}</div>
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
        <p className="text-muted text-[15px]">Memuat…</p>
      </Kerangka>
    );
  }

  if (!produk.data) {
    return (
      <Kerangka>
        <div className="rounded-card border-muted border p-4">
          <p className="font-semibold">Barang tidak ditemukan.</p>
          <Link
            href="/toko/barang"
            className="rounded-card bg-safe mt-3 inline-block px-4 py-3 font-semibold text-white"
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
        <h1 className="text-2xl font-bold">Ubah barang</h1>
        <p className="text-muted text-[15px]">{p.name}</p>
        <FormBarang
          mode="ubah"
          id={p.id}
          awal={isianDari(p)}
          onSelesai={() => void router.push(`/toko/barang/${p.id}`)}
        />
      </Kerangka>
    </>
  );
}
