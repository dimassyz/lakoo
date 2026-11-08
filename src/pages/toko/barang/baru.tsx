import Head from "next/head";
import { useRouter } from "next/router";
import { FormBarang } from "@/components/FormBarang";
import { AppShell } from "@/components/NavBar";

/** FSD §10 — tambah barang; 4 field wajib, sisanya terlipat. */
export default function BarangBaruPage() {
  const router = useRouter();
  const kembali =
    typeof router.query.kembali === "string" ? router.query.kembali : undefined;

  return (
    <>
      <Head>
        <title>Tambah barang — Lakoo</title>
      </Head>
      <AppShell>
        <div className="mx-auto w-full max-w-[560px] space-y-6 lg:max-w-[880px]">
          <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
            Tambah barang
          </h1>
          <div className="bg-card rounded-card border-line shadow-card border p-4 md:p-6">
            <FormBarang
              mode="baru"
              onSelesai={(id) =>
                void router.push(kembali ?? `/toko/barang/${id}`)
              }
            />
          </div>
        </div>
      </AppShell>
    </>
  );
}
