import { tombolUtama } from "@/lib/tombol";

/**
 * Keadaan gagal memuat data halaman (pola Beranda, dipakai semua halaman):
 * fetch yang gagal — termasuk koneksi putus/abort yang membuat promise
 * fetch melempar — berakhir di sini, bukan di "Memuat…" abadi. Tombol
 * memicu refetch lewat `muat`, bukan reload halaman.
 */
export function GagalMuat({ muat }: { muat: () => void }) {
  return (
    <div className="rounded-card border-garis bg-card border p-4">
      <p className="text-navy font-semibold">
        Gagal memuat. Periksa sinyal lalu coba lagi.
      </p>
      <button
        type="button"
        onClick={muat}
        className={`${tombolUtama} rounded-btn mt-4 inline-flex min-h-11 items-center px-4`}
      >
        Coba lagi
      </button>
    </div>
  );
}
