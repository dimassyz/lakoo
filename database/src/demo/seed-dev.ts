import { hash } from "@node-rs/argon2";
import { createDb } from "../db.ts";
import { users } from "../schema.ts";
import { generateDemo, todayWib } from "./generator.ts";
import { seedDemoTemplate } from "./seed.ts";

/** Hanya untuk lokal/preview (SPEC §10.2). Jangan dipakai di produksi. */
const DEV_EMAIL = "dev@lakoo.local";

/** Parameter argon2id dari SPEC §8. */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const { db, pool } = createDb();
try {
  const password = process.env.DEV_SEED_PASSWORD;
  if (password === undefined || password.length < 8 || password.length > 72) {
    throw new Error(
      "DEV_SEED_PASSWORD wajib diisi, 8–72 karakter — lihat .env.example",
    );
  }

  const asOf = todayWib();
  const summary = await seedDemoTemplate(db, generateDemo(asOf));
  await db
    .insert(users)
    .values({
      email: DEV_EMAIL,
      passwordHash: await hash(password, ARGON2_OPTIONS),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: await hash(password, ARGON2_OPTIONS) },
    });

  console.log(
    `template demo ${asOf}: ${summary.products} barang, ${summary.sales} penjualan; ` +
      `akun dev ${DEV_EMAIL} siap`,
  );
} finally {
  await pool.end();
}
