import { useCallback, useEffect, useState } from "react";
import { api, type Plan, type Results } from "./api";
import { hariIniWib } from "./ui";

/** FSD §12 — Berjalan memakai `state=active`, Riwayat memakai daftar penuh. */
export function useDaftarRencana(aktif: boolean) {
  const [items, setItems] = useState<Plan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const res = aktif
      ? await api.GET("/plans", { params: { query: { state: ["active"] } } })
      : await api.GET("/plans");

    if (res.error || !res.data) {
      setItems([]);
      setGagal(true);
    } else {
      setItems(res.data.items);
    }
    setMemuat(false);
  }, [aktif]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { items, memuat, gagal, muat };
}

/** FSD §13 — satu endpoint untuk hero, angka kecil, ringkasan, dan daftar. */
export function useHasil() {
  const [data, setData] = useState<Results | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data: hasil, error } = await api.GET("/results");
    if (error || !hasil) {
      setData(null);
      setGagal(true);
    } else {
      setData(hasil);
    }
    setMemuat(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { data, memuat, gagal, muat };
}

const LABEL: Record<Plan["state"], string> = {
  suggested: "Saran",
  active: "Berjalan",
  completed: "Selesai",
  exhausted: "Stok habis",
  sold_out: "Terjual habis",
  stopped: "Dihentikan",
};

export function labelRencana(state: Plan["state"]): string {
  return LABEL[state];
}

/** Tahap yang sedang dijalani; null bila rencana belum/sudah tidak berjalan. */
export function tahapSekarang(plan: Plan) {
  if (plan.currentStep === null) return null;
  return plan.steps.find((s) => s.stepNo === plan.currentStep) ?? null;
}

/** FSD §12 — "cek {dueOn}" ditandai merah bila jatuh tempo hari ini atau lewat. */
export function lewatTempo(dueOn: string | null): boolean {
  if (!dueOn) return false;
  return dueOn <= hariIniWib();
}
