import Head from "next/head";
import Link from "next/link";

/** FSD §2 — halaman statis satu layar; satu-satunya isi dinamis = kontak dari env. */
const BAGIAN = [
  {
    judul: "Yang kami simpan",
    isi: "Email akun Anda dan data toko: nama toko, jenis, lokasi, tipe pelanggan, daftar barang, penjualan harian, dan rencana obral. Semuanya diperlukan agar Lakoo bisa menghitung status barang dan menyusun saran.",
  },
  {
    judul: "Yang tidak kami simpan",
    isi: "Kami tidak menyimpan nomor pelanggan Anda, tidak memasang pelacak, tidak memakai analitik pihak ketiga, dan tidak memakai cookie selain cookie sesi untuk menjaga Anda tetap masuk.",
  },
  {
    judul: "Penyedia AI",
    isi: "Saat menyusun rencana tiga tahap, data barang (nama, status, stok, harga, dan angka penjualan) dikirim ke penyedia AI (Google) tanpa email Anda. Kalau AI gagal atau Anda mematikannya di Pengaturan, Lakoo memakai saran dasar yang dihitung sendiri.",
  },
  {
    judul: "Akun demo",
    isi: "Akun demo berisi data contoh dan dihapus dalam 24 jam. Anda tidak perlu memberi data toko sungguhan untuk mencobanya.",
  },
];

/** SPEC §7b — metadata lengkap untuk halaman publik; dipisah agar `Privasi` tetap pendek. */
function MetaPrivasi({ origin }: { origin: string }) {
  const deskripsi =
    "Data apa yang disimpan Lakoo, apa yang tidak, dan cara meminta penghapusan akun.";
  return (
    <Head>
      <title>Privasi — Lakoo</title>
      <meta name="description" content={deskripsi} />
      <link rel="canonical" href={`${origin}/privasi`} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content="Privasi — Lakoo" />
      <meta property="og:description" content={deskripsi} />
      <meta property="og:url" content={`${origin}/privasi`} />
      <meta property="og:image" content={`${origin}/og.png`} />
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  );
}

export default function Privasi({
  kontak,
  origin,
}: {
  kontak: string;
  origin: string;
}) {
  return (
    <>
      <MetaPrivasi origin={origin} />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Privasi</h1>
          <p className="text-[17px]">
            Ringkas dan tanpa bahasa hukum berbelit: ini yang kami simpan, ini
            yang tidak.
          </p>
        </div>

        {BAGIAN.map((b) => (
          <section key={b.judul} className="space-y-1">
            <h2 className="text-[17px] font-semibold">{b.judul}</h2>
            <p className="text-[17px]">{b.isi}</p>
          </section>
        ))}

        <section className="space-y-1">
          <h2 className="text-[17px] font-semibold">Menghapus akun</h2>
          <p className="text-[17px]">
            Kirim permintaan hapus akun ke{" "}
            <span className="font-semibold">
              {kontak || "(alamat kontak belum diatur di lingkungan ini)"}
            </span>
            . Kami menghapus akun beserta data tokonya, dan Anda akan mendapat
            balasan saat selesai.
          </p>
        </section>

        <footer className="border-muted border-t pt-4">
          <Link href="/" className="text-[15px] font-semibold underline">
            Kembali ke beranda
          </Link>
        </footer>
      </main>
    </>
  );
}

/** FSD §2 — alamat kontak dari env, ditampilkan sebagai teks (bukan tautan). */
export function getStaticProps() {
  return {
    props: {
      kontak: process.env.CONTACT_EMAIL ?? "",
      origin: process.env.APP_ORIGIN ?? "",
    },
  };
}
