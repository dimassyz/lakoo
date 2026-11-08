import type { ProductStatus } from "@/lib/api";
import { labelStatus } from "@/lib/ui";

/**
 * UI_FIX_SPEC §1 — chip status: pill, latar 10% token DASAR, teks token CHIP.
 * Kelas ditulis literal per status (bukan disusun dari `status`): Tailwind v4
 * memindai sumber untuk string kelas, jadi kelas dinamis tidak pernah jadi
 * utility. `stok_habis` bukan status masalah — muted netral, tanpa ramp.
 */
const kelasChip: Record<ProductStatus, string> = {
  sehat: "bg-sehat/10 text-sehat-chip",
  waspada: "bg-waspada/10 text-waspada-chip",
  sekarat: "bg-sekarat/10 text-sekarat-chip",
  mati: "bg-mati/10 text-mati-chip",
  stok_habis: "bg-muted/10 text-muted",
};

/** Kelas teks token CHIP per status — untuk label status sebaris teks. */
export const kelasTeksStatus: Record<ProductStatus, string> = {
  sehat: "text-sehat-chip",
  waspada: "text-waspada-chip",
  sekarat: "text-sekarat-chip",
  mati: "text-mati-chip",
  stok_habis: "text-muted",
};

export function ChipStatus({ status }: { status: ProductStatus }) {
  return (
    <span
      className={`rounded-pill inline-block px-2.5 py-1 text-xs font-bold whitespace-nowrap ${kelasChip[status]}`}
    >
      {labelStatus(status)}
    </span>
  );
}
