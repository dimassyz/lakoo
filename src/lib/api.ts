import createClient from "openapi-fetch";
import type { components, paths } from "./api-types";

/**
 * Satu klien untuk seluruh src/. Tipe diturunkan dari openapi.yaml
 * (`pnpm api:types`), bukan interface tulis tangan.
 */
export const api = createClient<paths>({
  baseUrl: "/api",
  credentials: "same-origin",
});

export type Dashboard = components["schemas"]["Dashboard"];
export type ProductSummary = components["schemas"]["ProductSummary"];
export type ProductDetail = components["schemas"]["ProductDetail"];
export type ProductStatus = components["schemas"]["ProductStatus"];
export type SalesRecap = components["schemas"]["SalesRecap"];
export type SalesRecapPut = components["schemas"]["SalesRecapPut"];
export type SalesRecapResult = components["schemas"]["SalesRecapResult"];
export type StockIn = components["schemas"]["StockIn"];
export type StockInBatchCreate = components["schemas"]["StockInBatchCreate"];
export type Plan = components["schemas"]["Plan"];
export type PlanStep = components["schemas"]["PlanStep"];
export type Results = components["schemas"]["Results"];
