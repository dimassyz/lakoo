import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { api } from "@/lib/api";

/**
 * FSD §1 — landing publik. Angka contoh di-hardcode saat build dari data demo
 * (FSD §1.2); halaman ini tidak memanggil API selain tombol demo.
 */
const ANGKA_CONTOH = {
  terkunci: "Rp1.284.000",
  mati: 9,
  sekarat: 8,
};

const LANGKAH = [
  {
    judul: "Catat saat tutup toko",
    isi: "Dua menit: masukkan penjualan hari ini per barang. Tidak perlu alat baru.",
  },
  {
    judul: "Lihat barang yang sekarat dan mati",
    isi: "Lakoo menandai barang yang tidak laku, plus modal yang tertahan di rak.",
  },
  {
    judul: "Jalankan rencana 3 tahap",
    isi: "Turunkan harga bertahap sampai barang laku, lalu lihat kas yang kembali.",
  },
];

const FAQ = [
  {
    tanya: "Apakah Lakoo aplikasi kasir?",
    jawab:
      "Bukan. Lakoo adalah asisten inventaris: mencatat penjualan harian, menandai barang yang tidak laku, dan menyusun rencana obral. Tidak ada struk, tidak ada printer, tidak ada pembayaran. Kalau Anda sudah punya kasir, Lakoo tetap bisa dipakai berdampingan karena pencatatan penjualan hanya butuh jumlah per barang.",
  },
  {
    tanya: "Apakah harus internet?",
    jawab:
      "Untuk membuka aplikasi, ya. Namun saat sinyal putus, isian Rekap Penjualan dan Barang Masuk disimpan dulu di HP dan dikirim otomatis ketika sinyal kembali. Jadi mencatat tetap bisa dilakukan di dalam toko yang sinyalnya buruk, tanpa kehilangan data.",
  },
  {
    tanya: "Bagaimana AI menyusun saran?",
    jawab:
      "Status barang dihitung dari data penjualan Anda, bukan dari AI: sehat, waspada, sekarat, atau mati. AI hanya menyusun kalimat rencana tiga tahap dari angka itu. Kalau AI gagal atau dimatikan, Lakoo memakai saran dasar yang sudah tersedia, sehingga rencana tetap muncul.",
  },
  {
    tanya: "Apakah data saya aman?",
    jawab:
      "Data toko disimpan di server kami dan hanya bisa dibuka lewat sesi akun Anda. Tidak ada analitik pihak ketiga, tidak ada pelacakan, dan tidak ada cookie selain cookie sesi. Kami tidak menjual data. Akun demo berisi data contoh dan otomatis kedaluwarsa setelah masa demo berakhir.",
  },
  {
    tanya: "Berapa biayanya?",
    jawab:
      "Gratis, tanpa kartu kredit dan tanpa masa uji coba berbatas. Anda bisa mencoba akun demo tanpa mendaftar untuk melihat cara kerjanya dengan data toko contoh, lalu membuat akun sendiri saat sudah yakin. Lakoo berbahasa Indonesia sepenuhnya.",
  },
];

const tombolUtama =
  "rounded-card bg-safe px-4 py-3 text-[16px] font-semibold text-white disabled:opacity-60";
const kartu = "rounded-card border-muted border p-4";

/** SPEC §7b — JSON-LD: SoftwareApplication, Organization, WebSite, FAQPage. */
function jsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Lakoo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "id",
        url: `${origin}/`,
        description:
          "Asisten inventaris untuk toko kelontong: menghitung modal yang tertahan di barang tidak laku dan menyusun rencana menjualnya kembali.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
      },
      { "@type": "Organization", name: "Lakoo", url: `${origin}/` },
      {
        "@type": "WebSite",
        name: "Lakoo",
        url: `${origin}/`,
        inLanguage: "id",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.tanya,
          acceptedAnswer: { "@type": "Answer", text: f.jawab },
        })),
      },
    ],
  };
}

function MetaBagikan({ origin }: { origin: string }) {
  const judul = "Lakoo — Cek Uang Terkunci di Stok Warungmu";
  const ringkas =
    "Hitung modal yang tertahan di barang tidak laku, lalu jalankan rencana 3 tahap untuk mengembalikannya jadi kas.";
  return (
    <>
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Lakoo" />
      <meta property="og:locale" content="id_ID" />
      <meta property="og:title" content={judul} />
      <meta property="og:description" content={ringkas} />
      <meta property="og:url" content={`${origin}/`} />
      <meta property="og:image" content={`${origin}/og.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={judul} />
      <meta name="twitter:description" content={ringkas} />
      <meta name="twitter:image" content={`${origin}/og.png`} />
    </>
  );
}

function Kepala({ origin }: { origin: string }) {
  return (
    <Head>
      <title>Lakoo — Cek Uang Terkunci di Stok Warungmu</title>
      <meta
        name="description"
        content="Lakoo menghitung modal yang tertahan di barang tidak laku dan memberi rencana menjualnya kembali. Gratis untuk toko kelontong, tanpa kartu kredit."
      />
      <link rel="canonical" href={`${origin}/`} />
      <MetaBagikan origin={origin} />
      <script
        type="application/ld+json"
        // Objek statis dari konstanta file ini, bukan input pengguna.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(origin)) }}
      />
    </Head>
  );
}

/** FSD §1.4 — tombol demo: idle → menyiapkan → /toko, atau pesan sesuai kode. */
function TombolDemo() {
  const router = useRouter();
  const [memproses, setMemproses] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function coba() {
    setMemproses(true);
    setPesan(null);
    const res = await api.POST("/auth/demo", { body: {} }).catch(() => null);

    if (res?.response.ok) {
      await router.push("/toko");
      return;
    }

    setPesan(
      res?.response.status === 429
        ? "Terlalu banyak percobaan dari jaringan ini, coba lagi nanti."
        : "Toko contoh sedang disiapkan, coba lagi sebentar.",
    );
    setMemproses(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void coba()}
          disabled={memproses}
          className={tombolUtama}
        >
          {memproses ? "Menyiapkan toko contoh…" : "Coba akun demo"}
        </button>
      </div>
      <p className="text-muted text-[15px]">
        Gratis. Tanpa kartu kredit. Bahasa Indonesia.
      </p>
      {pesan ? (
        <div role="alert" className={`${kartu} space-y-2`}>
          <p className="text-danger text-[15px] font-semibold">{pesan}</p>
          <button
            type="button"
            onClick={() => void coba()}
            disabled={memproses}
            className="rounded-card border-muted border px-3 py-2 text-[15px] font-semibold"
          >
            Coba lagi
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">
        Berapa uangmu yang terkunci di rak?
      </h1>
      <p className="text-[17px]">
        Lakoo menghitung modal yang tertahan di barang tidak laku dan memberi
        rencana menjualnya kembali.
      </p>
      <TombolDemo />
    </section>
  );
}

function AngkaContoh() {
  return (
    <section className={`${kartu} space-y-1`}>
      <p className="text-[17px] font-semibold">
        {ANGKA_CONTOH.terkunci} terkunci
      </p>
      <p className="text-muted text-[15px]">
        {ANGKA_CONTOH.mati} barang mati · {ANGKA_CONTOH.sekarat} sekarat
      </p>
      <p className="text-muted text-[13px]">Angka dari data toko contoh.</p>
    </section>
  );
}

function CaraKerja() {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">Cara kerja</h2>
      <ol className="space-y-3">
        {LANGKAH.map((l, i) => (
          <li key={l.judul} className={kartu}>
            <p className="text-[15px] font-semibold">
              {i + 1}. {l.judul}
            </p>
            <p className="text-[15px]">{l.isi}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Definisi() {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">Apa itu uang terkunci?</h2>
      <p className="text-[17px]">
        Uang terkunci adalah modal yang sudah Anda bayar untuk stok, tetapi
        belum kembali menjadi uang karena barangnya tidak laku. Selama barang
        itu diam di rak, uangnya tidak bisa dipakai membeli barang yang justru
        cepat habis.
      </p>
      <p className="text-[17px]">
        Contoh: 40 botol sampo × Rp18.500 = Rp740.000. Selama sampo itu tidak
        terjual, Rp740.000 tetap terkunci di rak.
      </p>
    </section>
  );
}

function PertanyaanUmum() {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">Pertanyaan umum</h2>
      <dl className="space-y-3">
        {FAQ.map((f) => (
          <div key={f.tanya} className={kartu}>
            <dt className="text-[15px] font-semibold">{f.tanya}</dt>
            <dd className="mt-1 text-[15px]">{f.jawab}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Kaki() {
  return (
    <footer className="border-muted text-muted flex flex-wrap gap-4 border-t pt-4 text-[13px]">
      <Link href="/privasi">Privasi</Link>
      <a href="https://github.com/dimassyz/lakoo">GitHub</a>
      <span>Karya GTNIC 2026</span>
    </footer>
  );
}

export default function Landing({ origin }: { origin: string }) {
  return (
    <>
      <Kepala origin={origin} />
      <main className="mx-auto max-w-2xl space-y-10 px-4 py-8">
        <Hero />
        <AngkaContoh />
        <CaraKerja />
        <Definisi />
        <PertanyaanUmum />
        <Kaki />
      </main>
    </>
  );
}

/** SPEC §7b — canonical absolut butuh APP_ORIGIN, jadi dibaca saat build. */
export function getStaticProps() {
  return { props: { origin: process.env.APP_ORIGIN ?? "" } };
}
