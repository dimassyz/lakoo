const TINGGI_MAKS = 80;

type Props = {
  /** Terjual per jendela 7 hari; indeks 0 = 7 hari terakhir (SPEC §4.2). */
  weekQty: number[];
};

/**
 * FSD §11.1 — batang dari `weekQty`, dibalik supaya kiri = terlama.
 * Tinggi dalam piksel, bukan persen: kolom flex tidak punya tinggi pasti,
 * jadi persentase akan runtuh.
 */
export function WeekChart({ weekQty }: Props) {
  const nilai = [...weekQty].reverse();
  const puncak = Math.max(1, ...nilai);

  return (
    <section className="rounded-card border-muted border p-3">
      <h2 className="text-muted text-[13px] font-semibold">
        Terjual per 7 hari · kiri terlama
      </h2>
      <div className="mt-2 flex items-end gap-1" aria-hidden="true">
        {nilai.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px]">{n}</span>
            <div
              className="bg-safe w-full rounded-t"
              style={{
                height: Math.max(2, Math.round((n / puncak) * TINGGI_MAKS)),
              }}
            />
          </div>
        ))}
      </div>
      <p className="sr-only">
        Penjualan tujuh hari terakhir, dari terlama ke terbaru:{" "}
        {nilai.join(", ")} unit.
      </p>
    </section>
  );
}
