import Head from "next/head";
import Link from "next/link";

/** FSD §2 — halaman statis satu layar; satu-satunya prop dinamis = origin. */
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
    "Data apa yang disimpan Lakoo, apa yang tidak, dan soal penghapusan data.";
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

/** Mockup privasi-mobile .top-link — bar kembali di atas kartu, khusus mobile. */
function BarKembaliMobile() {
  return (
    <div className="border-garis text-navy -mx-5 -mt-8 mb-6 border-b px-5 py-4 text-sm font-semibold md:hidden">
      <Link
        href="/"
        className="focus-visible:outline-navy no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        ‹ Kembali ke beranda
      </Link>
    </div>
  );
}

export default function Privasi({ origin }: { origin: string }) {
  return (
    <>
      <MetaPrivasi origin={origin} />

      <main className="mx-auto max-w-[680px] px-5 py-8 md:px-8">
        <BarKembaliMobile />
        <div className="rounded-card border-line space-y-6 border bg-white p-6 md:p-8">
          <div className="space-y-2">
            <h1 className="text-[24px] leading-[1.2] font-bold tracking-[-0.01em] md:text-[28px] lg:text-[32px]">
              Privasi
            </h1>
            <p className="leading-[1.7]">
              Ringkas dan tanpa bahasa hukum berbelit: ini yang kami simpan, ini
              yang tidak.
            </p>
          </div>

          {BAGIAN.map((b) => (
            <section key={b.judul} className="space-y-1">
              <h2 className="text-[19px] font-semibold">{b.judul}</h2>
              <p className="leading-[1.7]">{b.isi}</p>
            </section>
          ))}

          <section className="space-y-1">
            <h2 className="text-[19px] font-semibold">Menghapus data</h2>
            <p className="leading-[1.7]">
              Lakoo tidak punya pendaftaran akun; aksesnya hanya lewat akun demo
              yang datanya terhapus sendiri dalam 24 jam. Jadi tidak ada data
              tetap milik Anda yang tersimpan di sini.
            </p>
          </section>

          <footer className="border-line border-t pt-4">
            <Link
              href="/"
              className="hover:text-marigold-kuat focus-visible:outline-navy cursor-pointer font-semibold underline transition-colors duration-150 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Kembali ke beranda
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}

/** FSD §2 — origin untuk URL kanonis di metadata. */
export function getStaticProps() {
  return {
    props: {
      origin: process.env.APP_ORIGIN ?? "",
    },
  };
}
