import { Plus } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type ReactNode } from "react";
import { api, type Dashboard } from "@/lib/api";
import type { OutboxItem } from "@/lib/outbox";
import { tanggalPendek, useOnline } from "@/lib/ui";
import { useAntrean, type Antrean } from "@/lib/worker";

type Item = { href: string; label: string };

/** FSD §0.1 — 4 item utama; Rencana & Hasil langsung di desktop. */
const utama: Item[] = [
  { href: "/toko", label: "Beranda" },
  { href: "/toko/rekap", label: "Rekap" },
  { href: "/toko/barang-masuk", label: "Barang Masuk" },
  { href: "/toko/barang", label: "Barang" },
];

const lainnya: Item[] = [
  { href: "/toko/rencana", label: "Rencana" },
  { href: "/toko/hasil", label: "Hasil" },
  { href: "/toko/import", label: "Import" },
  { href: "/toko/pengaturan", label: "Pengaturan" },
];

const tautan = "flex items-center gap-2 rounded-btn px-3 py-3 text-[15px]";
const tombolKecil =
  "rounded-btn border-muted border px-3 py-3 text-[13px] font-semibold";

/** FSD §0.4 — keluar ditahan bila masih ada isian di antrean. */
export function Keluar({ antrean }: { antrean: Antrean }) {
  const router = useRouter();
  const [tanya, setTanya] = useState(false);

  async function keluar() {
    await api.POST("/auth/logout", { body: {} });
    await router.push("/");
  }

  if (!tanya) {
    return (
      <button
        type="button"
        onClick={() =>
          antrean.items.length > 0 ? setTanya(true) : void keluar()
        }
        className={`${tautan} text-muted w-full text-left`}
      >
        Keluar
      </button>
    );
  }

  return (
    <div className="rounded-card border-muted space-y-2 border p-3 text-[15px]">
      <p>
        {antrean.items.length} isian belum terkirim. Kalau keluar sekarang,
        isian itu tetap tersimpan di HP ini.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void keluar()}
          className={`${tombolKecil} border-danger text-danger`}
        >
          Tetap keluar
        </button>
        <button
          type="button"
          onClick={() => setTanya(false)}
          className={tombolKecil}
        >
          Batal
        </button>
      </div>
    </div>
  );
}

function DaftarItem({
  items,
  pathname,
  penanda = false,
}: {
  items: Item[];
  pathname: string;
  /** DESIGN-V3 §4 — item aktif di sidebar ditandai dot marigold. */
  penanda?: boolean;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const aktif = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={aktif ? "page" : undefined}
              className={`${tautan} ${aktif ? "text-navy font-semibold" : "text-muted"}`}
            >
              {penanda ? (
                <span
                  aria-hidden
                  className={`${aktif ? "bg-marigold-kuat" : "bg-transparent"} h-2 w-2 shrink-0 rounded-full`}
                />
              ) : null}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({
  antrean,
  store,
}: {
  antrean: Antrean;
  store?: Dashboard["store"];
}) {
  const { pathname } = useRouter();
  const namaToko = store?.name ?? "Toko";

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-line bg-card hidden w-60 shrink-0 border-r lg:block"
    >
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <p className="text-navy mb-4 flex items-center gap-1.5 px-3 text-2xl font-bold">
          Lakoo
          <span aria-hidden className="bg-marigold h-2.5 w-2.5 rounded-full" />
        </p>
        <DaftarItem
          items={[...utama, ...lainnya]}
          pathname={pathname}
          penanda
        />
        <div className="mt-auto">
          <div className="border-line flex items-center gap-3 border-t px-3 pt-4 pb-3">
            <span
              aria-hidden
              className="bg-navy text-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
            >
              {namaToko.charAt(0)}
            </span>
            <p className="text-navy text-[15px] font-semibold">{namaToko}</p>
          </div>
          <Keluar antrean={antrean} />
        </div>
      </div>
    </nav>
  );
}

const selBawah = "flex flex-col items-center py-3 text-[15px]";

function SelBawah({ item, pathname }: { item: Item; pathname: string }) {
  const aktif = pathname === item.href;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={aktif ? "page" : undefined}
        className={`${selBawah} ${aktif ? "text-navy font-semibold" : "text-muted"}`}
      >
        {item.label}
      </Link>
    </li>
  );
}

/** DESIGN-V3 §9 R-NAV — 5 sel: Beranda, Barang, + (ke Barang Masuk), Rekap,
    Lainnya. Barang Masuk tidak lagi sel teks; ia target tombol + tengah. */
function BottomNav({ antrean }: { antrean: Antrean }) {
  const { pathname } = useRouter();

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-muted bg-surface fixed inset-x-0 bottom-0 z-10 border-t lg:hidden"
    >
      <ul className="grid grid-cols-5">
        <SelBawah
          item={{ href: "/toko", label: "Beranda" }}
          pathname={pathname}
        />
        <SelBawah
          item={{ href: "/toko/barang", label: "Barang" }}
          pathname={pathname}
        />
        <li className="flex items-center justify-center">
          <Link
            href="/toko/barang-masuk"
            aria-label="Barang Masuk"
            aria-current={
              pathname === "/toko/barang-masuk" ? "page" : undefined
            }
            className="bg-navy text-card flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Plus aria-hidden size={24} />
          </Link>
        </li>
        <SelBawah
          item={{ href: "/toko/rekap", label: "Rekap" }}
          pathname={pathname}
        />
        <li>
          <details className="relative">
            <summary
              className={`${selBawah} text-muted cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            >
              Lainnya
            </summary>
            <div className="border-muted bg-surface absolute inset-x-0 bottom-full border-t p-2">
              <DaftarItem items={lainnya} pathname={pathname} />
              <Keluar antrean={antrean} />
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}

function statusTeks(it: OutboxItem): string {
  if (it.status === "needs_review") return "perlu diperbaiki";
  if (it.coba) return `gagal ${it.coba}× — dicoba lagi otomatis`;
  return "menunggu sinyal";
}

function hrefPerbaiki(it: OutboxItem): string {
  const halaman = it.kind === "recap" ? "/toko/rekap" : "/toko/barang-masuk";
  return `${halaman}?antrean=${it.id}`;
}

function BarisAntrean({
  item,
  onBuang,
}: {
  item: OutboxItem;
  onBuang: () => void;
}) {
  return (
    <li className="rounded-card border-muted border p-3 text-[15px]">
      <p className="font-semibold">
        {item.kind === "recap" ? "Rekap penjualan" : "Barang masuk"} ·{" "}
        {item.tanggal}
      </p>
      <p className="text-muted text-[13px]">
        {item.baris} baris · {statusTeks(item)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.status === "needs_review" ? (
          <Link href={hrefPerbaiki(item)} className={tombolKecil}>
            Buka &amp; perbaiki
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onBuang}
          className={`${tombolKecil} text-muted`}
        >
          Buang
        </button>
      </div>
    </li>
  );
}

/** FSD §0.4 — badge "{n} belum terkirim" + daftar antrean. */
function DaftarAntrean({ antrean }: { antrean: Antrean }) {
  return (
    <div className="border-muted space-y-2 border-t px-4 py-3">
      <ul className="space-y-2">
        {antrean.items.map((it) => (
          <BarisAntrean
            key={it.id}
            item={it}
            onBuang={() => void antrean.buang(it.id)}
          />
        ))}
      </ul>
      <button
        type="button"
        disabled={antrean.mengirim}
        onClick={() => void antrean.kirimSekarang()}
        className="rounded-btn bg-navy text-surface px-3 py-3 text-[15px] font-semibold disabled:opacity-50"
      >
        {antrean.mengirim ? "Mengirim…" : "Kirim sekarang"}
      </button>
    </div>
  );
}

function Kepala({
  store,
  antrean,
}: {
  store?: Dashboard["store"];
  antrean: Antrean;
}) {
  const [buka, setBuka] = useState(false);
  const n = antrean.items.length;

  return (
    <header className="border-muted border-b">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-muted text-[15px]">{store?.name ?? "Toko"}</p>
          <p className="text-muted text-[15px]">
            {tanggalPendek(new Date().toISOString())}
          </p>
        </div>
        {n > 0 ? (
          <button
            type="button"
            aria-expanded={buka}
            onClick={() => setBuka(!buka)}
            className="rounded-btn border-danger text-danger px-3 py-3 text-[13px] font-semibold"
          >
            {n} belum terkirim
          </button>
        ) : null}
      </div>
      {buka && n > 0 ? <DaftarAntrean antrean={antrean} /> : null}
    </header>
  );
}

function Pita({ children }: { children: ReactNode }) {
  return (
    <p className="border-muted bg-ink text-surface border-b px-4 py-2 text-[15px]">
      {children}
    </p>
  );
}

/** Kerangka /toko: pita demo, pita offline, header, sidebar/bottom nav. */
export function AppShell({
  children,
  store,
}: {
  children: ReactNode;
  store?: Dashboard["store"];
}) {
  const online = useOnline();
  const antrean = useAntrean();

  return (
    <div className="min-h-screen lg:flex">
      {/* SPEC §7b — seluruh rute /toko/* NOINDEX; hanya `/` dan `/privasi` yang diindeks. */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Sidebar antrean={antrean} store={store} />
      <div className="flex-1 pb-20 lg:pb-0">
        {store?.isDemo ? (
          <Pita>Akun demo — data di-reset setiap hari</Pita>
        ) : null}
        {online ? null : (
          <Pita>Tidak ada sinyal — isian tetap disimpan di HP</Pita>
        )}
        <Kepala store={store} antrean={antrean} />
        <main className="mx-auto w-full max-w-[1200px] px-5 py-5 md:px-8 md:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
      <BottomNav antrean={antrean} />
    </div>
  );
}
