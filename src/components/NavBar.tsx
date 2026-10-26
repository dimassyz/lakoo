import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { api, type Dashboard } from "@/lib/api";
import { tanggalPendek, useOnline } from "@/lib/ui";

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

const tautan = "block rounded-card px-3 py-2 text-[15px]";

function Keluar() {
  const router = useRouter();

  async function keluar() {
    await api.POST("/auth/logout");
    await router.push("/");
  }

  return (
    <button
      type="button"
      onClick={keluar}
      className={`${tautan} text-muted w-full text-left`}
    >
      Keluar
    </button>
  );
}

function DaftarItem({ items, pathname }: { items: Item[]; pathname: string }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className={`${tautan} ${pathname === item.href ? "text-safe font-semibold" : "text-ink"}`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Sidebar() {
  const { pathname } = useRouter();

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-muted hidden w-56 shrink-0 border-r lg:block"
    >
      <div className="sticky top-0 p-4">
        <p className="mb-4 px-3 text-2xl font-bold">Lakoo</p>
        <DaftarItem items={[...utama, ...lainnya]} pathname={pathname} />
        <div className="border-muted mt-4 border-t pt-2">
          <Keluar />
        </div>
      </div>
    </nav>
  );
}

function BottomNav() {
  const { pathname } = useRouter();
  const sel = "flex flex-col items-center py-3 text-[15px]";

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-muted bg-surface fixed inset-x-0 bottom-0 z-10 border-t lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {utama.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`${sel} ${pathname === item.href ? "text-safe font-semibold" : "text-ink"}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <details className="relative">
            <summary
              className={`${sel} text-muted cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            >
              Lainnya
            </summary>
            <div className="border-muted bg-surface absolute inset-x-0 bottom-full border-t p-2">
              <DaftarItem items={lainnya} pathname={pathname} />
              <Keluar />
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}

function Kepala({ store }: { store?: Dashboard["store"] }) {
  return (
    <header className="border-muted border-b px-4 py-3">
      <p className="text-muted text-[15px]">{store?.name ?? "Toko"}</p>
      <p className="text-muted text-[15px]">
        {tanggalPendek(new Date().toISOString())}
      </p>
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

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <div className="flex-1 pb-20 lg:pb-0">
        {store?.isDemo ? (
          <Pita>Akun demo — data di-reset setiap hari</Pita>
        ) : null}
        {online ? null : (
          <Pita>Tidak ada sinyal — isian tetap disimpan di HP</Pita>
        )}
        <Kepala store={store} />
        <main className="mx-auto w-full max-w-5xl px-4 py-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
