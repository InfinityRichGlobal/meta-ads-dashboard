import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  DatePreset,
  getAdInsights,
  getAdSetInsights,
  getCampaignInsights,
  getDateRange,
} from "../metaAdsService";
import { deriveMetrics } from "../../shared/metrics";
import { aiText, AI_SYSTEM_THAI } from "../aiUtils";
import { deleteAbTest, listAbTests, saveAbTest } from "../db";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);
const variantType = z.enum(["ad", "campaign", "adset"]);

/** Two-proportion z-test on conversion rate (conversions / clicks). */
export function zTest(aConv: number, aClicks: number, bConv: number, bClicks: number) {
  if (aClicks === 0 || bClicks === 0) return { z: 0, pValue: 1, significant: false };
  const p1 = aConv / aClicks;
  const p2 = bConv / bClicks;
  const pPool = (aConv + bConv) / (aClicks + bClicks);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / aClicks + 1 / bClicks));
  if (se === 0) return { z: 0, pValue: 1, significant: false };
  const z = (p1 - p2) / se;
  // Normal CDF approximation
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z: Number(z.toFixed(3)), pValue: Number(pValue.toFixed(4)), significant: pValue < 0.05 };
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - prob;
}

async function fetchVariantMetrics(
  type: string,
  id: string,
  accessToken: string,
  adAccountId: string,
  range: { since: string; until: string },
) {
  let rows: any[] = [];
  let idField = "ad_id";
  if (type === "ad") {
    rows = await getAdInsights(accessToken, adAccountId, range);
    idField = "ad_id";
  } else if (type === "adset") {
    rows = await getAdSetInsights(accessToken, adAccountId, range);
    idField = "adset_id";
  } else {
    rows = await getCampaignInsights(accessToken, adAccountId, range);
    idField = "campaign_id";
  }
  const row = rows.find((r) => String(r[idField]) === id);
  return deriveMetrics(row);
}

export const abtestRouter = router({
  history: protectedProcedure.query(async ({ ctx }) => listAbTests(ctx.user.id)),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAbTest(ctx.user.id, input.id);
      return { ok: true };
    }),

  compare: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        variantA: z.object({ type: variantType, id: z.string(), name: z.string().optional() }),
        variantB: z.object({ type: variantType, id: z.string(), name: z.string().optional() }),
        datePreset: datePresetSchema.default("last_30d"),
        save: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [mA, mB] = await Promise.all([
          fetchVariantMetrics(input.variantA.type, input.variantA.id, accessToken, adAccountId, range),
          fetchVariantMetrics(input.variantB.type, input.variantB.id, accessToken, adAccountId, range),
        ]);
        const stat = zTest(mA.conversions, mA.clicks, mB.conversions, mB.clicks);

        // Decide a tentative winner by ROAS then CPA then CTR
        let winner: "A" | "B" | "tie" = "tie";
        if (mA.roas !== mB.roas) winner = mA.roas > mB.roas ? "A" : "B";
        else if (mA.cpa !== mB.cpa && (mA.cpa > 0 || mB.cpa > 0)) winner = mA.cpa < mB.cpa ? "A" : "B";
        else if (mA.ctr !== mB.ctr) winner = mA.ctr > mB.ctr ? "A" : "B";

        const analysis = await aiText(
          AI_SYSTEM_THAI + " วิเคราะห์ผลการทดสอบ A/B และระบุผู้ชนะพร้อมเหตุผลและนัยสำคัญทางสถิติ",
          `Variant A (${input.variantA.name ?? input.variantA.id}): ${JSON.stringify(mA, null, 1)}\n\n` +
            `Variant B (${input.variantB.name ?? input.variantB.id}): ${JSON.stringify(mB, null, 1)}\n\n` +
            `สถิติ z-test (conversion rate): z=${stat.z}, p=${stat.pValue}, significant=${stat.significant}`,
          1500,
        );

        if (input.save) {
          await saveAbTest({
            userId: ctx.user.id,
            name: input.name,
            variantAType: input.variantA.type,
            variantAId: input.variantA.id,
            variantAName: input.variantA.name ?? null,
            variantBType: input.variantB.type,
            variantBId: input.variantB.id,
            variantBName: input.variantB.name ?? null,
            datePreset: input.datePreset,
            metricsA: mA as any,
            metricsB: mB as any,
            winner,
            aiAnalysis: analysis,
          });
        }
        return { metricsA: mA, metricsB: mB, stat, winner, analysis, range };
      });
    }),
});
