import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  ApiError,
  badOrigin,
  internalError,
  notFound,
  serviceUnavailable,
} from "./errors.ts";
import { authRoutes } from "./routes/auth.ts";
import { meRoutes } from "./routes/me.ts";
import { dashboardRoutes } from "./routes/dashboard.ts";
import { planRoutes } from "./routes/plans.ts";
import { resultRoutes } from "./routes/results.ts";
import { importRoutes } from "./routes/imports.ts";
import { cronRoutes } from "./routes/cron.ts";
import { productRoutes } from "./routes/products.ts";
import { salesRoutes } from "./routes/sales.ts";
import { stockInRoutes } from "./routes/stockIns.ts";
import { storeRoutes } from "./routes/store.ts";

export interface AppDeps {
  db: AnyDb;
  /** Origin yang boleh mengirim method non-GET (SPEC §8.1). */
  allowedOrigins: readonly string[];
  now?: () => Date;
  /** Env untuk pembacaan setelan AI; bawaan `process.env`. */
  env?: Record<string, string | undefined>;
  /** Injeksi `fetch` untuk test adapter AI. */
  fetchImpl?: typeof fetch;
}

/** Semua grup route, satu tempat — `createApp` tinggal memasang guard & health. */
function mountRoutes(app: Hono, deps: AppDeps, now: () => Date): void {
  const ai = { db: deps.db, now, env: deps.env, fetchImpl: deps.fetchImpl };
  app.route("/auth", authRoutes({ db: deps.db, now }));
  app.route("/", meRoutes({ db: deps.db, now }));
  app.route("/", productRoutes({ db: deps.db, now }));
  app.route("/", dashboardRoutes({ db: deps.db, now }));
  app.route("/", storeRoutes({ db: deps.db, now }));
  app.route("/", salesRoutes({ db: deps.db, now }));
  app.route("/", stockInRoutes({ db: deps.db, now }));
  app.route("/", planRoutes(ai));
  app.route("/", resultRoutes({ db: deps.db, now }));
  app.route("/", importRoutes({ db: deps.db, now }));
  app.route("/", cronRoutes(ai));
}

/**
 * App Hono seluruh API. Di-mount apa adanya oleh `src/pages/api/[...route].ts`.
 * Basis path `/api/v1` mengikuti `servers` di openapi.yaml.
 */
export function createApp(deps: AppDeps) {
  const app = new Hono().basePath("/api/v1");
  const now = deps.now ?? (() => new Date());

  // CSRF (SPEC §8.1): non-GET wajib Origin yang diizinkan + Content-Type JSON.
  app.use("*", async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD") return next();
    const origin = c.req.header("origin");
    if (origin === undefined || !deps.allowedOrigins.includes(origin)) {
      throw badOrigin();
    }
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      throw badOrigin();
    }
    return next();
  });

  mountRoutes(app, deps, now);

  app.get("/health", async (c) => {
    try {
      await deps.db.execute(sql`SELECT 1`);
    } catch {
      throw serviceUnavailable("Database tidak terjangkau.");
    }
    return c.json({ status: "ok" as const, time: now().toISOString() });
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      for (const [key, value] of Object.entries(err.headers))
        c.header(key, value);
      return c.json(err.toBody(), err.status as ContentfulStatusCode);
    }
    // Jangan bocorkan detail internal ke klien (SPEC §8.5 log hygiene).
    console.error("[api] unhandled", err);
    const fallback = internalError();
    return c.json(fallback.toBody(), fallback.status as ContentfulStatusCode);
  });

  app.notFound((c) => {
    const error = notFound();
    return c.json(error.toBody(), error.status as ContentfulStatusCode);
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApp>;
