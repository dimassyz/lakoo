import { createDb } from "../db.ts";
import { generateDemo, todayWib } from "./generator.ts";
import { seedDemoTemplate } from "./seed.ts";

/**
 * `pnpm db:seed:demo` — buat/regenerasi toko template demo (SPEC §10.2).
 * Deterministik terhadap tanggal, jadi cron harian menghasilkan isi yang sama
 * kecuali tanggalnya bergeser.
 */
const { db, pool } = createDb();
try {
  const asOf = todayWib();
  const summary = await seedDemoTemplate(db, generateDemo(asOf));
  console.log(
    `template demo ${asOf}: ${summary.products} barang, ${summary.sales} penjualan, ` +
      `${summary.stockIns} barang masuk, ${summary.plans} rencana`,
  );
} finally {
  await pool.end();
}
