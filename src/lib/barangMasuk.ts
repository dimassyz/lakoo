import { useCallback, useMemo, useState } from "react";
import {
  errorBaris,
  ringkasanMasuk,
  useBarangAktif,
  useFormMasuk,
  useSimpanMasuk,
} from "./barangMasuk.form";
import { useAksiRiwayat, useRiwayatMasuk } from "./barangMasuk.riwayat";

/**
 * Perekat layar barang masuk (FSD §8).
 * Bagian form ada di `barangMasuk.form.ts`, riwayat di `barangMasuk.riwayat.ts`;
 * file ini hanya menyatukan keduanya supaya pemanggil cukup satu import.
 */
export * from "./barangMasuk.form";
export * from "./barangMasuk.riwayat";

/** FSD §0.4 baris 81 — isian dibersihkan seolah tersimpan; kalau tidak,
 * "Simpan" kedua membuat item outbox baru dan stok tercatat dua kali. */
function gagalKirim(
  pesan: string,
  setToast: (s: string) => void,
  reset: () => void,
) {
  setToast(pesan);
  reset();
}

/** Perekat layar barang masuk. */
export function useLayarMasuk() {
  const produk = useBarangAktif();
  const riwayat = useRiwayatMasuk();
  const form = useFormMasuk();
  const [toast, setToast] = useState("");
  const [errorKirim, setErrorKirim] = useState<Record<string, string>>({});

  const { reset } = form;
  const { muat: muatRiwayat } = riwayat;

  const onSukses = useCallback(
    (jumlah: number) => {
      setToast(`Barang masuk tersimpan (${jumlah} baris)`);
      setErrorKirim({});
      reset();
      void muatRiwayat();
    },
    [reset, muatRiwayat],
  );
  const onGagal = useCallback(
    (pesan: string) => gagalKirim(pesan, setToast, reset),
    [reset],
  );
  const on422 = useCallback((peta: Record<string, string>) => {
    setErrorKirim(peta);
    setToast(`${Object.keys(peta).length} baris perlu dicek`);
  }, []);

  const { simpan, menyimpan } = useSimpanMasuk({
    tanggal: form.tanggal,
    daftar: form.daftar,
    onSukses,
    onGagal,
    on422,
  });
  const aksi = useAksiRiwayat(muatRiwayat);

  const lokal = useMemo(() => errorBaris(form.daftar), [form.daftar]);
  const error = useMemo(
    () => ({ ...lokal, ...errorKirim }),
    [lokal, errorKirim],
  );
  const angka = useMemo(() => ringkasanMasuk(form.daftar), [form.daftar]);

  return {
    produk,
    riwayat,
    form,
    aksi,
    toast,
    setToast,
    error,
    angka,
    simpan,
    menyimpan,
    bisa: angka.baris > 0 && Object.keys(error).length === 0 && !menyimpan,
  };
}

export type LayarMasuk = ReturnType<typeof useLayarMasuk>;
