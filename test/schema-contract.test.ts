import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../database/src/test/pglite.ts";

/**
 * Verifikasi kontrak constraint database — SPEC §4.1.
 *
 * Test QA independen: setiap ekspektasi diturunkan dari SPEC §4.1 (bukan dari
 * membaca implementasi skema), sehingga drift migrasi vs kontrak langsung
 * terlihat sebagai kegagalan di sini. Constraint yang hilang = temuan.
 */

type Db = Awaited<ReturnType<typeof createTestDb>>;

let ctx: Db;
let userSeq = 0;
let productSeq = 0;

beforeAll(async () => {
  ctx = await createTestDb();
}, 60_000);

afterAll(async () => {
  await ctx.client.close();
});

/** Sisipkan baris dan kembalikan id-nya; INSERT yang ditolak DB melempar. */
async function insertReturningId(
  table: string,
  columns: Record<string, string | number | boolean | null>,
): Promise<string> {
  const entries = Object.entries(columns);
  const result = await ctx.client.query<{ id: string }>(
    `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) ` +
      `VALUES (${entries.map((_, index) => `$${index + 1}`).join(", ")}) ` +
      "RETURNING id",
    entries.map(([, value]) => value),
  );
  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(`INSERT ${table} tidak mengembalikan id`);
  }
  return id;
}

async function insertUser(email?: string): Promise<string> {
  userSeq += 1;
  return insertReturningId("users", {
    email: email ?? `uji${userSeq}@lakoo.local`,
  });
}

async function makeStore(
  extra: Record<string, string | number | boolean | null> = {},
): Promise<string> {
  return insertReturningId("stores", {
    owner_user_id: await insertUser(),
    name: "Toko Uji",
    store_type: "toko_kelontong",
    ...extra,
  });
}

async function makeProduct(
  storeId: string,
  extra: Record<string, string | number | boolean | null> = {},
): Promise<string> {
  productSeq += 1;
  const name = `Barang Uji ${productSeq}`;
  return insertReturningId("products", {
    store_id: storeId,
    name,
    name_key: name.toLowerCase(),
    sell_price: 10_000,
    ...extra,
  });
}

/** Harapkan DB menolak pernyataan (check / unique / enum / not-null). */
async function expectRejected(
  statement: string | (() => Promise<unknown>),
): Promise<void> {
  const run =
    typeof statement === "string"
      ? () => ctx.client.exec(statement)
      : statement;
  await expect(run()).rejects.toThrow();
}

async function expectRejectedInsert(
  columns: Record<string, string | number | boolean | null>,
): Promise<void> {
  await expectRejected(() => insertReturningId("stores", columns));
}

async function countOf(table: string): Promise<number> {
  const result = await ctx.client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table}`,
  );
  return result.rows[0]?.n ?? -1;
}

describe("users (SPEC §4.1)", () => {
  it("email unik tanpa mempedulikan huruf besar/kecil (citext)", async () => {
    await insertUser("sri@lakoo.local");
    await expectRejected(
      "INSERT INTO users (email) VALUES ('SRI@lakoo.local')",
    );
  });

  it("password_hash nullable (akun demo tidak punya kata sandi)", async () => {
    const id = await insertUser("demo@lakoo.local");
    const rows = await ctx.client.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [id],
    );
    expect(rows.rows[0]?.password_hash).toBeNull();
  });
});

describe("stores — nama & lokasi (SPEC §4.1)", () => {
  it("nama toko 1–60 karakter", async () => {
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "",
      store_type: "toko_kelontong",
    });
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "a".repeat(61),
      store_type: "toko_kelontong",
    });
    const id = await insertReturningId("stores", {
      owner_user_id: await insertUser(),
      name: "a".repeat(60),
      store_type: "toko_kelontong",
    });
    expect(id).toBeTruthy();
  });

  it("lokasi ≤ 80 karakter atau null", async () => {
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "Lokasi Panjang",
      store_type: "lainnya",
      location: "a".repeat(81),
    });
    const id = await insertReturningId("stores", {
      owner_user_id: await insertUser(),
      name: "Lokasi Kosong",
      store_type: "lainnya",
      location: null,
    });
    expect(id).toBeTruthy();
  });
});

describe("stores — ambang status (SPEC §4.1)", () => {
  it("healthy_days < dead_days (check stores_thresholds)", async () => {
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "Ambang Sama",
      store_type: "lainnya",
      healthy_days: 14,
      dead_days: 14,
    });
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "Ambang Terbalik",
      store_type: "lainnya",
      healthy_days: 20,
      dead_days: 15,
    });
  });

  it("ambang dalam rentang: healthy 7–60, dead 15–180, warning 2–6", async () => {
    const violations: Array<[string, number]> = [
      ["healthy_days", 6],
      ["healthy_days", 61],
      ["dead_days", 14],
      ["dead_days", 181],
      ["warning_weeks", 1],
      ["warning_weeks", 7],
    ];
    for (const [column, value] of violations) {
      await expectRejectedInsert({
        owner_user_id: await insertUser(),
        name: `Rentang ${column} ${value}`,
        store_type: "lainnya",
        [column]: value,
      });
    }
  });
});

describe("stores — kepemilikan & enum (SPEC §4.1)", () => {
  it("satu pengguna = satu toko (unique owner_user_id)", async () => {
    const owner = await insertUser("satu-toko@lakoo.local");
    await makeStore({ owner_user_id: owner, name: "Toko Pertama" });
    await expectRejectedInsert({
      owner_user_id: owner,
      name: "Toko Kedua",
      store_type: "toko_kelontong",
    });
  });

  it("store_type dan customer_types di luar enum ditolak", async () => {
    await expectRejectedInsert({
      owner_user_id: await insertUser(),
      name: "Enum Salah",
      store_type: "warung",
    });
    await expectRejected(
      "INSERT INTO stores (owner_user_id, name, store_type, customer_types) " +
        "SELECT id, 'Pelanggan Salah', 'lainnya', " +
        "'{bukan_enum}'::customer_type[] FROM users " +
        "WHERE email = 'satu-toko@lakoo.local'",
    );
  });
});

describe("products — keunikan nama (SPEC §4.1)", () => {
  it("nama unik per toko saat aktif (case/spasi-insensitive)", async () => {
    const storeId = await makeStore();
    await makeProduct(storeId, {
      name: "Kecap Manis",
      name_key: "kecap manis",
    });
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, sell_price) ` +
        `VALUES ('${storeId}', 'kecap   manis', 'kecap manis', 24000)`,
    );
  });

  it("nama bisa dipakai ulang setelah barang diarsipkan (partial unique)", async () => {
    const storeId = await makeStore();
    const first = await makeProduct(storeId, {
      name: "Gula Pasir",
      name_key: "gula pasir",
    });
    await ctx.client.exec(
      `UPDATE products SET archived_at = now() WHERE id = '${first}'`,
    );
    const second = await makeProduct(storeId, {
      name: "Gula Pasir",
      name_key: "gula pasir",
    });
    expect(second).not.toBe(first);
  });

  it("nama sama di toko berbeda diperbolehkan", async () => {
    const storeA = await makeStore();
    const storeB = await makeStore();
    await makeProduct(storeA, {
      name: "Minyak Goreng",
      name_key: "minyak goreng",
    });
    const other = await makeProduct(storeB, {
      name: "Minyak Goreng",
      name_key: "minyak goreng",
    });
    expect(other).toBeTruthy();
  });
});

describe("products — panjang & harga (SPEC §4.1)", () => {
  it("nama 1–80, unit ≤ 16, kategori ≤ 40", async () => {
    const storeId = await makeStore();
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, sell_price) ` +
        `VALUES ('${storeId}', '', 'kosong', 1000)`,
    );
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, sell_price) ` +
        `VALUES ('${storeId}', repeat('a', 81), 'panjang', 1000)`,
    );
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, unit, sell_price) ` +
        `VALUES ('${storeId}', 'Unit Panjang', 'unit panjang', ` +
        `repeat('a', 17), 1000)`,
    );
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, category, sell_price) ` +
        `VALUES ('${storeId}', 'Kategori Panjang', 'kategori panjang', ` +
        `repeat('a', 41), 1000)`,
    );
  });

  it("harga jual tidak negatif", async () => {
    const storeId = await makeStore();
    await expectRejected(
      `INSERT INTO products (store_id, name, name_key, sell_price) ` +
        `VALUES ('${storeId}', 'Harga Negatif', 'harga negatif', -1)`,
    );
  });
});

describe("stock_ins (SPEC §4.1, §4.2)", () => {
  it("qty 0 diperbolehkan (baris opening tanpa stok)", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    const id = await insertReturningId("stock_ins", {
      store_id: storeId,
      product_id: productId,
      received_on: "2026-11-09",
      qty: 0,
      unit_cost: 21_000,
      kind: "opening",
      batch_id: crypto.randomUUID(),
    });
    expect(id).toBeTruthy();
  });

  it("qty atau unit_cost negatif ditolak", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO stock_ins (store_id, product_id, received_on, qty, ` +
        `unit_cost, kind, batch_id) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', -1, 21000, ` +
        `'purchase', gen_random_uuid())`,
    );
    await expectRejected(
      `INSERT INTO stock_ins (store_id, product_id, received_on, qty, ` +
        `unit_cost, kind, batch_id) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 5, -1, ` +
        `'purchase', gen_random_uuid())`,
    );
  });

  it("kind di luar enum ditolak", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO stock_ins (store_id, product_id, received_on, qty, ` +
        `unit_cost, kind, batch_id) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 5, 1000, ` +
        `'pinjam', gen_random_uuid())`,
    );
  });
});

describe("daily_sales (SPEC §4.1, §5.8)", () => {
  it("satu baris per (produk, tanggal) — mekanisme 'ganti, bukan tambah'", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await ctx.client.exec(
      `INSERT INTO daily_sales (store_id, product_id, sale_date, qty, ` +
        `unit_price, source) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 3, 24000, 'quantity')`,
    );
    await expectRejected(
      `INSERT INTO daily_sales (store_id, product_id, sale_date, qty, ` +
        `unit_price, source) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 9, 24000, 'quantity')`,
    );
  });

  it("qty 0 ditolak — koreksi harus menghapus baris, bukan menyimpan 0", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO daily_sales (store_id, product_id, sale_date, qty, ` +
        `unit_price, source) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 0, 24000, 'quantity')`,
    );
  });

  it("unit_price negatif ditolak", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO daily_sales (store_id, product_id, sale_date, qty, ` +
        `unit_price, source) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 3, -1, 'quantity')`,
    );
  });
});

describe("stock_adjustments (SPEC §4.1)", () => {
  it("qty_delta 0 ditolak; delta negatif diperbolehkan", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO stock_adjustments (store_id, product_id, adjusted_on, ` +
        `qty_delta, reason) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 0, 'correction')`,
    );
    const id = await insertReturningId("stock_adjustments", {
      store_id: storeId,
      product_id: productId,
      adjusted_on: "2026-11-09",
      qty_delta: -5,
      reason: "correction",
    });
    expect(id).toBeTruthy();
  });
});

describe("action_plans — satu rencana hidup (SPEC §4.1, §4.3)", () => {
  it("satu rencana hidup (suggested/active) per produk", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    const base = {
      store_id: storeId,
      product_id: productId,
      source: "template",
      product_status_at_generation: "mati",
      rationale: "Barang tidak laku",
    };
    await insertReturningId("action_plans", { ...base, state: "suggested" });
    await expectRejected(
      `INSERT INTO action_plans (store_id, product_id, source, state, ` +
        `product_status_at_generation, rationale) VALUES ` +
        `('${storeId}', '${productId}', 'template', 'active', 'mati', ` +
        `'Rencana kedua')`,
    );
  });

  it("rencana yang sudah berakhir tidak menghalangi rencana baru", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    const base = {
      store_id: storeId,
      product_id: productId,
      source: "template",
      product_status_at_generation: "mati",
      rationale: "Barang tidak laku",
    };
    await insertReturningId("action_plans", { ...base, state: "completed" });
    const second = await insertReturningId("action_plans", {
      ...base,
      state: "suggested",
    });
    expect(second).toBeTruthy();
  });
});

describe("action_plans — panjang & rentang (SPEC §4.1)", () => {
  it("rationale ≤ 200 karakter dan current_step 1–3 atau null", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId);
    await expectRejected(
      `INSERT INTO action_plans (store_id, product_id, source, state, ` +
        `product_status_at_generation, rationale) VALUES ` +
        `('${storeId}', '${productId}', 'template', 'suggested', 'mati', ` +
        `repeat('a', 201))`,
    );
    await expectRejected(
      `INSERT INTO action_plans (store_id, product_id, source, state, ` +
        `product_status_at_generation, rationale, current_step) VALUES ` +
        `('${storeId}', '${productId}', 'template', 'suggested', 'mati', ` +
        `'Oke', 4)`,
    );
    const ok = await insertReturningId("action_plans", {
      store_id: storeId,
      product_id: productId,
      source: "template",
      state: "suggested",
      product_status_at_generation: "mati",
      rationale: "Oke",
    });
    expect(ok).toBeTruthy();
  });
});

async function makePlan(): Promise<string> {
  const storeId = await makeStore();
  const productId = await makeProduct(storeId);
  return insertReturningId("action_plans", {
    store_id: storeId,
    product_id: productId,
    source: "template",
    state: "suggested",
    product_status_at_generation: "mati",
    rationale: "Rencana uji",
  });
}

function stepColumns(
  planId: string,
  extra: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  return {
    plan_id: planId,
    step_no: 1,
    action_type: "discount",
    title: "Turunkan harga",
    instructions: "Pindah ke rak depan",
    success_criteria: "Laku dalam sepekan",
    duration_days: 7,
    new_price: 20_000,
    profit_per_unit: -1_000,
    cash_back_estimate: 240_000,
    is_loss: true,
    outcome: "pending",
    ...extra,
  };
}

describe("plan_steps — nomor & panjang teks (SPEC §4.1)", () => {
  it("step_no 1–3 dan unik per rencana", async () => {
    const planId = await makePlan();
    await insertReturningId("plan_steps", stepColumns(planId, {}));
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 1, 'discount', 'Duplikat', 'Instruksi', 'Kriteria', ` +
        `7, 20000, -1000, 240000, true, 'pending')`,
    );
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 4, 'discount', 'Tahap Empat', 'Instruksi', ` +
        `'Kriteria', 7, 20000, -1000, 240000, true, 'pending')`,
    );
  });

  it("panjang teks: title 60, instructions 300, success_criteria 120, share_text 500", async () => {
    const planId = await makePlan();
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 2, 'discount', repeat('a', 61), 'Instruksi', ` +
        `'Kriteria', 7, 20000, -1000, 240000, true, 'pending')`,
    );
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 2, 'discount', 'Judul', repeat('a', 301), ` +
        `'Kriteria', 7, 20000, -1000, 240000, true, 'pending')`,
    );
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 2, 'discount', 'Judul', 'Instruksi', ` +
        `repeat('a', 121), 7, 20000, -1000, 240000, true, 'pending')`,
    );
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome, share_text) ` +
        `VALUES ('${planId}', 2, 'discount', 'Judul', 'Instruksi', ` +
        `'Kriteria', 7, 20000, -1000, 240000, true, 'pending', ` +
        `repeat('a', 501))`,
    );
  });
});

describe("plan_steps — rentang parameter & enum (SPEC §4.1)", () => {
  it("duration_days 3–21, discount 0–50, below_cost 5–50", async () => {
    const planId = await makePlan();
    for (const [column, value] of [
      ["duration_days", 2],
      ["duration_days", 22],
      ["discount_percent", -1],
      ["discount_percent", 51],
      ["below_cost_percent", 4],
      ["below_cost_percent", 51],
    ] as const) {
      await expectRejected(
        `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
          `instructions, success_criteria, duration_days, new_price, ` +
          `profit_per_unit, cash_back_estimate, is_loss, outcome, ${column}) ` +
          `VALUES ('${planId}', 2, 'discount', 'Judul', 'Instruksi', ` +
          `'Kriteria', 7, 20000, -1000, 240000, true, 'pending', ${value})`,
      );
    }
  });

  it("action_type di luar enum ditolak", async () => {
    const planId = await makePlan();
    await expectRejected(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 2, 'obral_besar', 'Judul', 'Instruksi', 'Kriteria', ` +
        `7, 20000, -1000, 240000, true, 'pending')`,
    );
  });
});

describe("weekly_summaries (SPEC §4.1)", () => {
  it("tepat 3 kalimat", async () => {
    const storeId = await makeStore();
    await expectRejected(
      `INSERT INTO weekly_summaries (store_id, week_start, sentences) ` +
        `VALUES ('${storeId}', '2026-11-01', ARRAY['satu', 'dua'])`,
    );
    await ctx.client.exec(
      `INSERT INTO weekly_summaries (store_id, week_start, sentences) ` +
        `VALUES ('${storeId}', '2026-11-02', ARRAY['satu', 'dua', 'tiga'])`,
    );
    expect(await countOf("weekly_summaries")).toBeGreaterThan(0);
  });
});

describe("idempotency_keys (SPEC §4.1, §7)", () => {
  it("key sama di toko berbeda diperbolehkan; di toko sama ditolak", async () => {
    const storeA = await makeStore();
    const storeB = await makeStore();
    const key = crypto.randomUUID();
    const insert = (storeId: string) =>
      `INSERT INTO idempotency_keys (store_id, key, endpoint, status_code, ` +
      `response_body) VALUES ('${storeId}', '${key}', 'PUT /sales/recap', ` +
      `200, '{"ok":true}'::jsonb)`;
    await ctx.client.exec(insert(storeA));
    await ctx.client.exec(insert(storeB));
    await expectRejected(insert(storeA));
  });
});

describe("cascade (SPEC §4.1: store_id ON DELETE CASCADE)", () => {
  it("menghapus toko menghapus barang, barang masuk, penjualan, rencana, dan tahap", async () => {
    const storeId = await makeStore({ name: "Toko Buang" });
    const productId = await makeProduct(storeId, { name: "Barang Buang" });
    await ctx.client.exec(
      `INSERT INTO stock_ins (store_id, product_id, received_on, qty, ` +
        `unit_cost, kind, batch_id) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 10, 5000, 'purchase', ` +
        `gen_random_uuid())`,
    );
    await ctx.client.exec(
      `INSERT INTO daily_sales (store_id, product_id, sale_date, qty, ` +
        `unit_price, source) VALUES ` +
        `('${storeId}', '${productId}', '2026-11-09', 2, 7000, 'quantity')`,
    );
    const planId = await insertReturningId("action_plans", {
      store_id: storeId,
      product_id: productId,
      source: "template",
      state: "suggested",
      product_status_at_generation: "mati",
      rationale: "Rencana buang",
    });
    await ctx.client.exec(
      `INSERT INTO plan_steps (plan_id, step_no, action_type, title, ` +
        `instructions, success_criteria, duration_days, new_price, ` +
        `profit_per_unit, cash_back_estimate, is_loss, outcome) VALUES ` +
        `('${planId}', 1, 'discount', 'Judul', 'Instruksi', 'Kriteria', ` +
        `7, 20000, -1000, 240000, true, 'pending')`,
    );

    // Hitung total keseluruhan sebelum/sesudah: baris milik test lain tidak
    // boleh ikut terhapus, baris toko ini wajib hilang semua.
    const tables = [
      "products",
      "stock_ins",
      "daily_sales",
      "action_plans",
      "plan_steps",
    ];
    const before: Record<string, number> = {};
    for (const table of tables) {
      before[table] = await countOf(table);
    }

    await ctx.client.exec(`DELETE FROM stores WHERE id = '${storeId}'`);

    for (const table of tables) {
      expect(
        await countOf(table),
        `${table} harus berkurang tepat 1 baris`,
      ).toBe((before[table] ?? 0) - 1);
    }
  });
});
