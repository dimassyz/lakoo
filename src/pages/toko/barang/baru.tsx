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
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Tambah barang</h1>
          <FormBarang
            mode="baru"
            onSelesai={(id) =>
              void router.push(kembali ?? `/toko/barang/${id}`)
            }
          />
        </div>
      </AppShell>
    </>
  );
}
