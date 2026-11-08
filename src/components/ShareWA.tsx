import { useState } from "react";

/* Palet v6 + affordance (mock.css .btn-primary/.btn-ghost). */
const tombolUtama =
  "rounded-btn cursor-pointer bg-[#E8A33D] px-4 py-3 font-semibold text-navy transition duration-150 hover:bg-[#D9932B] focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";
const tombolGaris =
  "rounded-btn border-muted cursor-pointer border px-4 py-3 font-semibold transition duration-150 hover:border-slate hover:text-navy focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 active:translate-y-px";

function bisaPakaiShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function"
  );
}

function TombolBagikan({ isi, onTutup }: { isi: string; onTutup: () => void }) {
  async function keAplikasiLain() {
    try {
      await (
        navigator as Navigator & {
          share: (d: { text: string }) => Promise<void>;
        }
      ).share({ text: isi });
    } catch {
      // dibatalkan pengguna — bukan kegagalan
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          window.open(
            `https://wa.me/?text=${encodeURIComponent(isi)}`,
            "_blank",
            "noopener",
          )
        }
        className={tombolUtama}
      >
        Bagikan
      </button>
      {bisaPakaiShare() ? (
        <button
          type="button"
          onClick={() => void keAplikasiLain()}
          className={tombolGaris}
        >
          Bagikan ke aplikasi lain
        </button>
      ) : null}
      <button type="button" onClick={onTutup} className={tombolGaris}>
        Tutup
      </button>
    </div>
  );
}

/** FSD §11.3 — teks bisa diedit, tidak disimpan ke server. */
export function ShareWA({
  teks,
  onTutup,
}: {
  teks: string;
  onTutup: () => void;
}) {
  const [isi, setIsi] = useState(teks);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Bagikan ke WhatsApp"
    >
      <button
        type="button"
        aria-label="Tutup"
        onClick={onTutup}
        className="bg-ink/40 absolute inset-0 cursor-pointer"
      />
      <div className="rounded-card bg-surface relative w-full space-y-2 p-4">
        <p className="font-semibold">Bagikan ke WhatsApp</p>
        <textarea
          rows={5}
          maxLength={500}
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          className="rounded-card border-muted focus:border-marigold-kuat focus:ring-marigold/25 w-full border px-3 py-2 text-[15px] transition duration-150 focus:ring-[3px] focus:outline-none"
        />
        <p className="text-muted text-[13px]">{isi.length}/500</p>
        <TombolBagikan isi={isi} onTutup={onTutup} />
      </div>
    </div>
  );
}
