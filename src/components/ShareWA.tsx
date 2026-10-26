import { useState } from "react";

const tombolUtama = "rounded-card bg-safe px-4 py-3 font-semibold text-white";
const tombolGaris = "rounded-card border-muted border px-4 py-3 font-semibold";

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
        className="bg-ink/40 absolute inset-0"
      />
      <div className="rounded-card bg-surface relative w-full space-y-2 p-4">
        <p className="font-semibold">Bagikan ke WhatsApp</p>
        <textarea
          rows={5}
          maxLength={500}
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          className="rounded-card border-muted w-full border px-3 py-2 text-[15px]"
        />
        <p className="text-muted text-[13px]">{isi.length}/500</p>
        <TombolBagikan isi={isi} onTutup={onTutup} />
      </div>
    </div>
  );
}
