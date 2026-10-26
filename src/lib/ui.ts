import { useEffect, useState } from "react";
import type { ProductStatus } from "./api";

/** FSD §0.5 — Rupiah tanpa desimal; negatif ditulis −Rp1.200. */
export function rupiah(value: number): string {
  const body = Math.abs(value).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
  return `${value < 0 ? "−" : ""}Rp${body}`;
}

/** FSD §0.5 — tanggal pendek "3 Nov", selalu WIB. */
export function tanggalPendek(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

/** FSD §0.5 — tanggal panjang "Senin, 3 November 2026", selalu WIB. */
export function tanggalPanjang(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

/** FSD §0.6 — status selalu tampil sebagai ikon + label teks. */
export function labelStatus(status: ProductStatus): string {
  switch (status) {
    case "sehat":
      return "Sehat";
    case "waspada":
      return "Waspada";
    case "sekarat":
      return "Sekarat";
    case "mati":
      return "Mati";
    case "stok_habis":
      return "Stok habis";
  }
}

/** Tanggal ISO (YYYY-MM-DD) hari ini menurut WIB. */
export function hariIniWib(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/** Geser tanggal ISO sejumlah hari. */
export function geserHari(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** FSD §7 — pemilih tanggal hanya ≤ hari ini dan ≥ 365 hari lalu. */
export function batasTanggal(): { min: string; max: string } {
  const max = hariIniWib();
  return { min: geserHari(max, -365), max };
}

/** FSD §0.2 — pita "Tidak ada sinyal" saat offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
