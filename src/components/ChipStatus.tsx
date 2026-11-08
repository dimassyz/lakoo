import type { ProductStatus } from "@/lib/api";
import { labelStatus } from "@/lib/ui";

/**
 * UI_FIX_SPEC §1 + PALETTE-V6 — chip status: pill, latar token tint chip v6,
 * teks token CHIP yang dipergelap. Kelas ditulis literal per status (bukan
 * disusun dari `status`): Tailwind v4 memindai sumber untuk string kelas,
 * jadi kelas dinamis tidak pernah jadi utility. `stok_habis` bukan status
 * masalah — muted netral, tanpa ramp.
 */
const kelasChip: Record<ProductStatus, string> = {
  sehat: "bg-sehat-chipbg text-sehat-chip",
  waspada: "bg-waspada-chipbg text-waspada-chip",
  sekarat: "bg-sekarat-chipbg text-sekarat-chip",
  mati: "bg-mati-chipbg text-mati-chip",
  stok_habis: "bg-muted/10 text-muted",
};

/** Varian "ubin" — chip di atas ubin status Beranda: latar PUTIH supaya
    terbaca di atas tint ubin yang pekat; teks tetap token CHIP status. */
const kelasChipUbin: Record<ProductStatus, string> = {
  sehat: "bg-white text-sehat-chip",
  waspada: "bg-white text-waspada-chip",
  sekarat: "bg-white text-sekarat-chip",
  mati: "bg-white text-mati-chip",
  stok_habis: "bg-white text-muted",
};

/** Kelas teks token CHIP per status — untuk label status sebaris teks. */
export const kelasTeksStatus: Record<ProductStatus, string> = {
  sehat: "text-sehat-chip",
  waspada: "text-waspada-chip",
  sekarat: "text-sekarat-chip",
  mati: "text-mati-chip",
  stok_habis: "text-muted",
};

export function ChipStatus({
  status,
  variant,
}: {
  status: ProductStatus;
  variant?: "ubin";
}) {
  const kelas = variant === "ubin" ? kelasChipUbin[status] : kelasChip[status];
  return (
    <span
      className={`rounded-pill inline-block px-2.5 py-1 text-xs font-bold whitespace-nowrap ${kelas}`}
    >
      {labelStatus(status)}
    </span>
  );
}
