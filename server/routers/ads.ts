import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import { DatePreset, getAdInsights, getAds, getDateRange } from "../metaAdsService";
import { aggregateMetrics, classifySignal, deriveMetrics } from "../../shared/metrics";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);

export const adsRouter = router({
  /**
   * Full ads table with metrics, signal lights and account-wide benchmarks
   * (avg CTR / CPA / ROAS used to colour each row relative to the account).
   */
  table: protectedProcedure
    .input(
      z.object({
        datePreset: datePresetSchema.default("last_7d"),
        targetCpa: z.number().optional(),
        minRoas: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ads, insights] = await Promise.all([
          getAds(accessToken, adAccountId),
          getAdInsights(accessToken, adAccountId, range),
        ]);
        const insById = new Map<string, any>();
        for (const i of insights) insById.set(String(i.ad_id), i);

        const benchmark = aggregateMetrics(insights);
        const targetCpa = input.targetCpa ?? benchmark.cpa;
        const minRoas = input.minRoas ?? Math.max(benchmark.roas, 1);

        const rows = ads.map((a) => {
          const ins = insById.get(String(a.id));
          const m = deriveMetrics(ins);
          const c = a.creative ?? {};
          const thumb =
            c.thumbnail_url ||
            c.image_url ||
            c.object_story_spec?.video_data?.image_url ||
            c.object_story_spec?.link_data?.picture ||
            null;
          return {
            id: a.id,
            name: a.name,
            status: a.status,
            effectiveStatus: a.effective_status,
            campaignId: a.campaign_id,
            adsetId: a.adset_id,
            thumbnailUrl: thumb,
            metrics: m,
            signal: classifySignal(m, { targetCpa, minRoas }),
          };
        });
        // sort by spend desc so the most important ads bubble up
        rows.sort((a, b) => b.metrics.spend - a.metrics.spend);
        return { rows, benchmark, targetCpa, minRoas };
      });
    }),
});
