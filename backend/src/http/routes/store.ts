import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { currentSession } from "../auth-context.ts";
import { DEFAULT_THRESHOLDS } from "../../domain/product.ts";
import { ApiError, validationError } from "../errors.ts";
import { toMe } from "../serialize.ts";
import { readJson } from "../validate.ts";
import { updateStore, type StoreUpdate } from "../../repo/store.ts";

export interface StoreDeps {
  db: AnyDb;
  now: () => Date;
}

const STORE_TYPES = [
  "warung_kelontong",
  "toko_kelontong",
  "minimarket_kecil",
  "warung_sembako",
  "lainnya",
] as const;

const CUSTOMER_TYPES = [
  "warga_perumahan",
  "anak_sekolah",
  "pekerja_pabrik_kantor",
  "pedagang_lain",
  "pengendara_lewat",
  "kos_mahasiswa",
] as const;

const storePatch = z
  .object({
    name: z.string().min(1).max(60).optional(),
    storeType: z.enum(STORE_TYPES).nullable().optional(),
    location: z.string().max(80).nullable().optional(),
    customerTypes: z
      .array(z.enum(CUSTOMER_TYPES))
      .max(6)
      .refine(
        (list) => new Set(list).size === list.length,
        "customerTypes tidak boleh duplikat",
      )
      .optional(),
    healthyDays: z.number().int().min(7).max(60).optional(),
    deadDays: z.number().int().min(15).max(180).optional(),
    warningWeeks: z.number().int().min(2).max(6).optional(),
    resetThresholds: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
    completeOnboarding: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "kirim minimal satu field");

type StorePatch = z.infer<typeof storePatch>;

/**
 * `resetThresholds` menang atas field ambang lain (kontrak), dan
 * `healthyDays < deadDays` diperiksa terhadap nilai **hasil gabungan**,
 * bukan hanya yang dikirim — kalau tidak, `{deadDays: 10}` bisa lolos.
 */
function thresholdsOf(
  patch: StorePatch,
  current: { healthyDays: number; deadDays: number; warningWeeks: number },
): Pick<StoreUpdate, "healthyDays" | "deadDays" | "warningWeeks"> {
  if (patch.resetThresholds === true) return { ...DEFAULT_THRESHOLDS };

  const next = {
    healthyDays: patch.healthyDays ?? current.healthyDays,
    deadDays: patch.deadDays ?? current.deadDays,
    warningWeeks: patch.warningWeeks ?? current.warningWeeks,
  };
  if (next.healthyDays >= next.deadDays) {
    throw validationError({
      healthyDays: "healthyDays harus lebih kecil dari deadDays",
    });
  }
  return next;
}

/** Field yang tidak memengaruhi ambang; dipisah supaya `buildUpdate` tetap terbaca. */
function plainFields(patch: StorePatch): StoreUpdate {
  const update: StoreUpdate = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.storeType !== undefined) update.storeType = patch.storeType;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.customerTypes !== undefined)
    update.customerTypes = [...patch.customerTypes];
  if (patch.aiEnabled !== undefined) update.aiEnabled = patch.aiEnabled;
  return update;
}

const TOUCHES_THRESHOLDS = [
  "resetThresholds",
  "healthyDays",
  "deadDays",
  "warningWeeks",
] as const;

function buildUpdate(
  patch: StorePatch,
  store: Parameters<typeof toMe>[1],
  now: Date,
): StoreUpdate {
  const update = plainFields(patch);
  const touches = TOUCHES_THRESHOLDS.some((key) => patch[key] !== undefined);
  if (touches) Object.assign(update, thresholdsOf(patch, store));
  if (patch.completeOnboarding === true) update.onboardedAt = now;
  return update;
}

async function handlePatch(c: Context, deps: StoreDeps) {
  const { store, user } = await currentSession(c, deps);
  // Toko demo tidak boleh diubah (SPEC §8.4).
  if (store.demoExpiresAt !== null) {
    throw new ApiError(403, "forbidden_demo", "Toko demo tidak bisa diubah");
  }

  const patch = await readJson(c, storePatch);
  const updated = await updateStore(
    deps.db,
    store.id,
    buildUpdate(patch, store, deps.now()),
  );
  return c.json(toMe(user, updated).store);
}

export function storeRoutes(deps: StoreDeps) {
  const app = new Hono();
  app.patch("/store", (c) => handlePatch(c, deps));
  return app;
}
