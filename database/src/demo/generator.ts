import { CATALOG, type CatalogItem } from "./catalog.ts";
import { createRng, distribute, pick, randInt, type Rng } from "./rng.ts";

/** Riwayat demo 90 hari; tanggal relatif terhadap kemarin (SPEC §10.2). */
export const HISTORY_DAYS = 90;
export const DEMO_SEED = 20261110;
export const DEMO_TEMPLATE_EMAIL = "template@lakoo.local";

export const DEMO_STORE = {
  name: "Toko Bu Sri",
  storeType: "toko_kelontong",
  location: "Kec. Lowokwaru, Malang",
  customerTypes: ["warga_perumahan", "anak_sekolah", "kos_mahasiswa"],
  healthyDays: 14,
  deadDays: 45,
  warningWeeks: 3,
} as const;

/** Minggu lebih ramai (SPEC §10.2: "akhir pekan lebih ramai"). */
const WEEKDAY_WEIGHT = [1.6, 1, 1, 1, 1, 1, 1.6] as const;

/** Pola waspada: [w4, w3, w2, w1] menurun tegas dengan basis ≥ 4 (SPEC §5.1). */
const WARNING_PATTERNS = [
  [12, 9, 5, 2],
  [8, 6, 4, 1],
  [16, 11, 7, 3],
  [10, 7, 5, 2],
  [14, 10, 6, 3],
  [9, 7, 5, 2],
  [18, 13, 8, 4],
] as const;

export interface GeneratedStockIn {
  receivedOn: string;
  qty: number;
  unitCost: number;
  kind: "opening" | "purchase";
}

export interface GeneratedSale {
  saleDate: string;
  qty: number;
  unitPrice: number;
}

export interface GeneratedProduct {
  name: string;
  nameKey: string;
  unit: string;
  category: string;
  sellPrice: number;
  lastCost: number;
  isComplementary: boolean;
  complementaryMaxStock: number | null;
  stockIns: GeneratedStockIn[];
  sales: GeneratedSale[];
}

export interface GeneratedPlanStep {
  stepNo: number;
  actionType:
    | "display_move"
    | "bundle"
    | "discount"
    | "promo_wa"
    | "sell_at_cost"
    | "clearance";
  title: string;
  instructions: string;
  successCriteria: string;
  durationDays: number;
  discountPercent: number | null;
  belowCostPercent: number | null;
  newPrice: number;
  profitPerUnit: number;
  cashBackEstimate: number;
  isLoss: boolean;
  shareText: string | null;
  outcome: "pending" | "in_progress" | "succeeded" | "failed" | "skipped";
  startedOn: string | null;
  dueOn: string | null;
  endedOn: string | null;
}

export interface GeneratedPlan {
  productName: string;
  source: "ai" | "template";
  state:
    "suggested" | "active" | "completed" | "exhausted" | "stopped" | "sold_out";
  productStatusAtGeneration:
    "sehat" | "waspada" | "sekarat" | "mati" | "stok_habis";
  rationale: string;
  startedOn: string | null;
  endedOn: string | null;
  lockedValueAtStart: number | null;
  currentStep: number | null;
  steps: GeneratedPlanStep[];
}

export interface DemoData {
  store: typeof DEMO_STORE;
  templateOwnerEmail: string;
  products: GeneratedProduct[];
  plans: GeneratedPlan[];
}

/** Tanggal bisnis hari ini di WIB (SPEC §3.6: "hari ini" dihitung server dalam WIB). */
export function todayWib(now = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

export function shiftIsoDate(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Minggu. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** `name_key` = lower + trim + spasi tunggal (SPEC §4.1). */
export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Tanggal penjualan: nomor hari `d` berarti `asOf - d` (d=1 = kemarin). */
function dateOfDay(asOf: string, day: number): string {
  return shiftIsoDate(asOf, -day);
}

function weeklyTotals(role: CatalogItem["role"], rng: Rng): number[] {
  const totals = new Array<number>(14).fill(0);
  if (role === "waspada") {
    const pattern = pick(rng, WARNING_PATTERNS);
    for (let week = 1; week <= 4; week += 1) {
      totals[week] = pattern[4 - week] ?? 0;
    }
    for (let week = 5; week <= 13; week += 1) {
      totals[week] = (pattern[0] ?? 0) + randInt(rng, 0, 3);
    }
    return totals;
  }
  const base = randInt(rng, 2, role === "sehat" ? 26 : 18);
  for (let week = 1; week <= 13; week += 1) {
    // Minggu 1..4 dibuat tidak pernah menurun tegas, supaya tidak jadi waspada.
    totals[week] =
      week <= 4 ? base + (4 - week) : Math.max(1, base + randInt(rng, -1, 2));
  }
  return totals;
}

/**
 * Jendela `week_qty[k]` = `asOf − 7(k−1) … asOf − 7k + 6` (SPEC §4.2), yaitu
 * nomor hari `7(k−1) … 7k−1`. Hari 0 (hari ini) tidak pernah berisi penjualan
 * karena riwayat demo berakhir kemarin.
 */
function weekToDays(week: number): number[] {
  const days: number[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (week - 1) * 7 + offset;
    if (day >= 1) days.push(day);
  }
  return days;
}

function spreadWeek(
  total: number,
  days: readonly number[],
  asOf: string,
): Map<number, number> {
  const weights = days.map(
    (day) => WEEKDAY_WEIGHT[weekdayOf(dateOfDay(asOf, day))] ?? 1,
  );
  const parts = distribute(total, weights);
  const result = new Map<number, number>();
  days.forEach((day, index) => {
    const qty = parts[index] ?? 0;
    if (qty > 0) result.set(day, qty);
  });
  return result;
}

function buildSales(
  item: CatalogItem,
  rng: Rng,
  asOf: string,
): Map<number, number> {
  if (item.neverSold) return new Map();

  const totals = weeklyTotals(item.role, rng);
  const sales = new Map<number, number>();
  for (let week = 1; week <= 13; week += 1) {
    const total = totals[week] ?? 0;
    if (total <= 0) continue;
    for (const [day, qty] of spreadWeek(total, weekToDays(week), asOf)) {
      sales.set(day, qty);
    }
  }
  return trimSales(item, sales, rng);
}

/** Buang penjualan di luar jendela yang dibutuhkan peran (SPEC §5.1). */
function trimSales(
  item: CatalogItem,
  sales: Map<number, number>,
  rng: Rng,
): Map<number, number> {
  const keep = (day: number): boolean => {
    if (item.revived) return day <= 10;
    switch (item.role) {
      case "sekarat": {
        const lastSaleDay = randInt(rng, 16, 44);
        return day >= lastSaleDay;
      }
      case "mati":
        return day >= 46;
      case "stok_habis":
        return day <= 7;
      default:
        return true;
    }
  };
  const trimmed = new Map<number, number>();
  for (const [day, qty] of sales) {
    if (keep(day)) trimmed.set(day, qty);
  }
  return trimmed;
}

function endStockFor(item: CatalogItem, rng: Rng): number {
  if (item.endStock !== undefined) return item.endStock;
  switch (item.role) {
    case "stok_habis":
      return 0;
    case "sehat":
      return randInt(rng, 6, 60);
    case "waspada":
      return randInt(rng, 4, 25);
    case "sekarat":
      return randInt(rng, 3, 30);
    case "mati":
      return randInt(rng, 3, 25);
  }
}

function restockDays(role: CatalogItem["role"], rng: Rng): number[] {
  if (role !== "sehat" && role !== "waspada") return [];
  const days: number[] = [];
  let day = HISTORY_DAYS;
  for (;;) {
    day -= randInt(rng, 7, 14);
    if (day < 1) break;
    days.push(day);
  }
  return days;
}

function salesInRange(
  sales: Map<number, number>,
  fromDay: number,
  toDay: number,
): number {
  let total = 0;
  for (const [day, qty] of sales) {
    if (day >= fromDay && day <= toDay) total += qty;
  }
  return total;
}

/**
 * Alokasi barang masuk: tiap event menutup penjualan pada rentangnya sendiri dan
 * stok akhir ditaruh di event pembuka, sehingga stok tidak pernah negatif.
 */
function buildStockIns(
  item: CatalogItem,
  sales: Map<number, number>,
  rng: Rng,
  asOf: string,
): GeneratedStockIn[] {
  const endStock = endStockFor(item, rng);
  const events = [HISTORY_DAYS, ...restockDays(item.role, rng)];
  return events.map((day, index) => {
    const nextDay = events[index + 1];
    const rangeLow = nextDay === undefined ? 1 : nextDay + 1;
    const qty =
      salesInRange(sales, rangeLow, day) + (index === 0 ? endStock : 0);
    return {
      receivedOn: dateOfDay(asOf, day),
      qty,
      unitCost: jitterCost(item.lastCost, index === events.length - 1, rng),
      kind: index === 0 ? "opening" : "purchase",
    };
  });
}

function jitterCost(lastCost: number, isNewest: boolean, rng: Rng): number {
  if (isNewest) return lastCost;
  const factor = 0.97 + rng() * 0.06;
  return Math.max(100, Math.round((lastCost * factor) / 50) * 50);
}

function buildProduct(
  item: CatalogItem,
  rng: Rng,
  asOf: string,
): GeneratedProduct {
  const sales = buildSales(item, rng, asOf);
  return {
    name: item.name,
    nameKey: nameKeyOf(item.name),
    unit: item.unit,
    category: item.category,
    sellPrice: item.sellPrice,
    lastCost: item.lastCost,
    isComplementary: item.isComplementary ?? false,
    complementaryMaxStock: item.complementaryMaxStock ?? null,
    stockIns: buildStockIns(item, sales, rng, asOf),
    sales: [...sales.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, qty]) => ({
        saleDate: dateOfDay(asOf, day),
        qty,
        unitPrice: item.sellPrice,
      })),
  };
}

/** Stok pada tanggal tertentu = Σ barang masuk − Σ penjualan (SPEC §4.2). */
export function stockOn(product: GeneratedProduct, isoDate: string): number {
  const inQty = product.stockIns
    .filter((row) => row.receivedOn <= isoDate)
    .reduce((acc, row) => acc + row.qty, 0);
  const soldQty = product.sales
    .filter((row) => row.saleDate <= isoDate)
    .reduce((acc, row) => acc + row.qty, 0);
  return inQty - soldQty;
}

/** Bulatkan ke Rp100 terdekat, minimal Rp100 (SPEC §5.4). */
function round100(value: number): number {
  return Math.max(100, Math.round(value / 100) * 100);
}

const SHARE_TEXT =
  "Promo {nama_toko}: {nama_barang} sekarang {harga_baru} (biasanya {harga_lama}). " +
  "Berlaku sampai {berlaku_sampai}. Stok terbatas!";

interface StepDraft {
  actionType: GeneratedPlanStep["actionType"];
  title: string;
  instructions: string;
  successCriteria: string;
  durationDays: number;
  discountPercent?: number;
  belowCostPercent?: number;
  newPrice: number;
  shareText?: string;
}

interface StepTiming {
  stepNo: number;
  outcome: GeneratedPlanStep["outcome"];
  lastCost: number;
  stock: number;
  startedOn: string | null;
  dueOn: string | null;
  endedOn: string | null;
}

function toStep(draft: StepDraft, timing: StepTiming): GeneratedPlanStep {
  const profitPerUnit = draft.newPrice - timing.lastCost;
  return {
    stepNo: timing.stepNo,
    actionType: draft.actionType,
    title: draft.title,
    instructions: draft.instructions,
    successCriteria: draft.successCriteria,
    durationDays: draft.durationDays,
    discountPercent: draft.discountPercent ?? null,
    belowCostPercent: draft.belowCostPercent ?? null,
    newPrice: draft.newPrice,
    profitPerUnit,
    cashBackEstimate: draft.newPrice * Math.max(timing.stock, 0),
    isLoss: profitPerUnit < 0,
    shareText: draft.shareText ?? null,
    outcome: timing.outcome,
    startedOn: timing.startedOn,
    dueOn: timing.dueOn,
    endedOn: timing.endedOn,
  };
}

/** Teks tahap statis (SPEC §4.1: bebas digit); hanya harga yang dihitung per barang. */
const ACTIVE_STEPS = {
  discount: {
    actionType: "discount",
    title: "Turunkan harga",
    instructions:
      "Pasang harga promo di rak depan dan beri tanda diskon supaya pembeli langsung melihatnya.",
    successCriteria: "Barang laku lagi sebelum tenggat.",
    durationDays: 7,
    discountPercent: 15,
    shareText: SHARE_TEXT,
  },
  sellAtCost: {
    actionType: "sell_at_cost",
    title: "Jual seharga kulakan",
    instructions:
      "Jual tanpa ambil untung supaya uang yang terkunci kembali ke kas.",
    successCriteria: "Sisa stok berkurang sebelum tenggat.",
    durationDays: 7,
    shareText: SHARE_TEXT,
  },
  clearance: {
    actionType: "clearance",
    title: "Obral rugi terakhir",
    instructions:
      "Obral sisa stok dengan harga di bawah kulakan supaya rak kosong dan uang pulih.",
    successCriteria: "Tidak ada sisa stok di rak.",
    durationDays: 7,
    belowCostPercent: 20,
    shareText: SHARE_TEXT,
  },
} satisfies Record<string, Omit<StepDraft, "newPrice">>;

const COMPLETED_STEP = {
  actionType: "display_move",
  title: "Pindahkan ke rak depan",
  instructions: "Taruh dekat kasir supaya pembeli melihatnya saat membayar.",
  successCriteria: "Barang laku lagi sebelum tenggat.",
  durationDays: 7,
} satisfies Omit<StepDraft, "newPrice">;

const SKIPPED_STEP = {
  actionType: "discount",
  title: "Turunkan harga",
  instructions:
    "Cadangan bila tahap pertama belum cukup menggerakkan penjualan.",
  successCriteria: "Barang laku lagi sebelum tenggat.",
  durationDays: 7,
  discountPercent: 10,
} satisfies Omit<StepDraft, "newPrice">;

/** Rencana `active` pada barang mati yang mulai laku lagi (SPEC §10.2). */
function buildActivePlan(
  product: GeneratedProduct,
  asOf: string,
): GeneratedPlan {
  const startedOn = shiftIsoDate(asOf, -10);
  const stock = Math.max(stockOn(product, startedOn), 1);
  const { sellPrice: sell, lastCost: cost } = product;
  const dueOne = shiftIsoDate(startedOn, 7);
  const dueTwo = shiftIsoDate(dueOne, 7);
  const timing = (
    stepNo: number,
    outcome: GeneratedPlanStep["outcome"],
    from: string | null,
    due: string | null,
    ended: string | null,
  ): StepTiming => ({
    stepNo,
    outcome,
    lastCost: cost,
    stock,
    startedOn: from,
    dueOn: due,
    endedOn: ended,
  });

  const stepOne = toStep(
    { ...ACTIVE_STEPS.discount, newPrice: round100(sell * 0.85) },
    timing(1, "succeeded", startedOn, dueOne, dueOne),
  );
  const stepTwo = toStep(
    { ...ACTIVE_STEPS.sellAtCost, newPrice: Math.max(cost, 100) },
    timing(2, "in_progress", dueOne, dueTwo, null),
  );
  const stepThree = toStep(
    { ...ACTIVE_STEPS.clearance, newPrice: round100(cost * 0.8) },
    timing(3, "pending", null, null, null),
  );

  return {
    productName: product.name,
    source: "template",
    state: "active",
    productStatusAtGeneration: "mati",
    rationale: "Sudah lama tidak laku dan uangnya terkunci di rak.",
    startedOn,
    endedOn: null,
    lockedValueAtStart: stock * cost,
    currentStep: 2,
    steps: [stepOne, stepTwo, stepThree],
  };
}

/** Rencana `completed` yang berhasil di tahap pertama (SPEC §10.2). */
function buildCompletedPlan(
  product: GeneratedProduct,
  asOf: string,
): GeneratedPlan {
  const startedOn = shiftIsoDate(asOf, -25);
  const endedOn = shiftIsoDate(startedOn, 7);
  const stock = Math.max(stockOn(product, startedOn), 1);
  const cost = product.lastCost;

  const stepOne = toStep(
    { ...COMPLETED_STEP, newPrice: product.sellPrice },
    {
      stepNo: 1,
      outcome: "succeeded",
      lastCost: cost,
      stock,
      startedOn,
      dueOn: endedOn,
      endedOn,
    },
  );
  const skipped = (stepNo: number): GeneratedPlanStep =>
    toStep(
      { ...SKIPPED_STEP, newPrice: round100(product.sellPrice * 0.9) },
      {
        stepNo,
        outcome: "skipped",
        lastCost: cost,
        stock,
        startedOn: null,
        dueOn: null,
        endedOn: null,
      },
    );

  return {
    productName: product.name,
    source: "template",
    state: "completed",
    productStatusAtGeneration: "sehat",
    rationale: "Barang sehat yang perlu dipindah agar lebih terlihat pembeli.",
    startedOn,
    endedOn,
    lockedValueAtStart: stock * cost,
    currentStep: null,
    steps: [stepOne, skipped(2), skipped(3)],
  };
}

function requireProduct(
  products: GeneratedProduct[],
  name: string,
): GeneratedProduct {
  const found = products.find((product) => product.name === name);
  if (found === undefined)
    throw new Error(`Katalog demo tidak memuat "${name}"`);
  return found;
}

function buildPlans(
  products: GeneratedProduct[],
  asOf: string,
): GeneratedPlan[] {
  const revived = requireProduct(products, "Sabun Mandi Batang");
  const healthy = requireProduct(products, "Biskuit Kelapa");
  return [buildActivePlan(revived, asOf), buildCompletedPlan(healthy, asOf)];
}

/** Data demo deterministik (SPEC §10.2). */
export function generateDemo(
  asOf: string = todayWib(),
  seed: number = DEMO_SEED,
): DemoData {
  const rng = createRng(seed);
  const products = CATALOG.map((item) => buildProduct(item, rng, asOf));
  return {
    store: DEMO_STORE,
    templateOwnerEmail: DEMO_TEMPLATE_EMAIL,
    products,
    plans: buildPlans(products, asOf),
  };
}
