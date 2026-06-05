import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  DatePreset,
  getAdInsights,
  getAds,
  getAdSetInsights,
  getAdSets,
  getCampaignInsights,
  getCampaigns,
  getDateRange,
  updateAdStatus,
} from "../metaAdsService";
import { aggregateMetrics, classifySignal, deriveMetrics } from "../../shared/metrics";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);

function mergeInsights<T extends Record<string, any>>(
  entities: any[],
  insights: any[],
  idKey: string,
  insightIdField: string,
) {
  const byId = new Map<string, any>();
  for (const ins of insights) byId.set(String(ins[insightIdField]), ins);
  return entities.map((e) => {
    const ins = byId.get(String(e[idKey]));
    const m = deriveMetrics(ins);
    return { ...e, metrics: m, signal: classifySignal(m) };
  });
}

export const campaignsRouter = router({
  list: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [campaigns, insights] = await Promise.all([
          getCampaigns(accessToken, adAccountId),
          getCampaignInsights(accessToken, adAccountId, range),
        ]);
        return mergeInsights(campaigns, insights, "id", "campaign_id");
      });
    }),

  adsets: protectedProcedure
    .input(z.object({ campaignId: z.string().optional(), datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [adsets, insights] = await Promise.all([
          getAdSets(accessToken, adAccountId, input.campaignId),
          getAdSetInsights(accessToken, adAccountId, range),
        ]);
        return mergeInsights(adsets, insights, "id", "adset_id");
      });
    }),

  ads: protectedProcedure
    .input(z.object({ campaignId: z.string().optional(), datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ads, insights] = await Promise.all([
          getAds(accessToken, adAccountId, input.campaignId),
          getAdInsights(accessToken, adAccountId, range),
        ]);
        const merged = mergeInsights(ads, insights, "id", "ad_id");
        return merged.map((a) => {
          const c = a.creative ?? {};
          const thumb =
            c.thumbnail_url ||
            c.image_url ||
            c.object_story_spec?.video_data?.image_url ||
            c.object_story_spec?.link_data?.picture ||
            null;
          return { ...a, thumbnailUrl: thumb };
        });
      });
    }),

  /** Pause or resume an ad. */
  setAdStatus: protectedProcedure
    .input(z.object({ adId: z.string(), status: z.enum(["ACTIVE", "PAUSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken } = await resolveToken(ctx.user.id);
      return withMetaErrors(async () => {
        await updateAdStatus(accessToken, input.adId, input.status);
        return { ok: true };
      });
    }),

  /** Bulk pause/resume. */
  bulkSetAdStatus: protectedProcedure
    .input(z.object({ adIds: z.array(z.string()).min(1), status: z.enum(["ACTIVE", "PAUSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken } = await resolveToken(ctx.user.id);
      const results: { adId: string; ok: boolean; error?: string }[] = [];
      for (const adId of input.adIds) {
        try {
          await updateAdStatus(accessToken, adId, input.status);
          results.push({ adId, ok: true });
        } catch (e: any) {
          results.push({ adId, ok: false, error: e?.message });
        }
      }
      return { results };
    }),

  /** Single campaign detail: campaign info + aggregated metrics + its adsets. */
  detail: protectedProcedure
    .input(z.object({ campaignId: z.string(), datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [campaigns, campaignIns, adsets, adsetIns] = await Promise.all([
          getCampaigns(accessToken, adAccountId),
          getCampaignInsights(accessToken, adAccountId, range),
          getAdSets(accessToken, adAccountId, input.campaignId),
          getAdSetInsights(accessToken, adAccountId, range),
        ]);
        const campaign = campaigns.find((c) => String(c.id) === input.campaignId) ?? null;
        const cIns = campaignIns.find((i) => String(i.campaign_id) === input.campaignId);
        const metrics = deriveMetrics(cIns);
        const mergedAdsets = mergeInsights(adsets, adsetIns, "id", "adset_id");
        return { campaign, metrics, signal: classifySignal(metrics), adsets: mergedAdsets };
      });
    }),

  /** Quick aggregate summary for a single campaign. */
  summary: protectedProcedure
    .input(z.object({ campaignId: z.string(), datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const insights = await getAdSetInsights(accessToken, adAccountId, range);
        const rows = insights.filter((i) => String(i.campaign_id) === input.campaignId);
        return aggregateMetrics(rows);
      });
    }),
});
