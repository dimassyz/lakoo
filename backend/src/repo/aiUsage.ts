import { eq, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { aiUsageDaily, stores } from "../../../database/src/schema.ts";

export interface AiQuota {
  storeAiEnabled: boolean;
  globalCallsToday: number;
  storeCallsToday: number;
}

const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

/**
 * Kuota §6.1 #3. Kuota global dari `ai_usage_daily`; kuota toko dihitung dari
 * `action_plans.generated_at` yang bersumber `ai` — persis seperti teks SPEC.
 */
export async function aiQuotaFor(
  db: AnyDb,
  storeId: string,
  today: string,
): Promise<AiQuota> {
  const storeRow = await db
    .select({ aiEnabled: stores.aiEnabled })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const usage = await db
    .select({ calls: aiUsageDaily.calls })
    .from(aiUsageDaily)
    .where(eq(aiUsageDaily.usageDate, today))
    .limit(1);

  const rows = await db.execute(sql`
    SELECT COUNT(*) AS n FROM action_plans
    WHERE store_id = ${storeId} AND source = 'ai'
      AND generated_at::date = ${today}::date`);

  return {
    storeAiEnabled: storeRow[0]?.aiEnabled ?? false,
    globalCallsToday: usage[0]?.calls ?? 0,
    storeCallsToday: num((rows.rows[0] as { n: unknown } | undefined)?.n),
  };
}

/** SPEC §6.1 #7: catat calls + token dari `usageMetadata` setelah panggilan AI. */
export async function recordAiUsage(
  db: AnyDb,
  today: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO ai_usage_daily (usage_date, calls, input_tokens, output_tokens)
    VALUES (${today}::date, 1, ${inputTokens}, ${outputTokens})
    ON CONFLICT (usage_date) DO UPDATE SET
      calls = ai_usage_daily.calls + 1,
      input_tokens = ai_usage_daily.input_tokens + ${inputTokens},
      output_tokens = ai_usage_daily.output_tokens + ${outputTokens}`);
}
