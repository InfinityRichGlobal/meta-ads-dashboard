import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  DatePreset,
  getDateRange,
  getInsights,
  getPreviousPeriodRange,
} from "../metaAdsService";
// getInsights re-used for syncLive
import { aggregateMetrics, pctChange } from "../../shared/metrics";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);

export const dashboardRouter = router({
  /** KPI overview with % change vs the previous equally-sized period. */
  overview: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_7d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      const prevRange = getPreviousPeriodRange(range);

      return withMetaErrors(async () => {
        const [curRows, prevRows] = await Promise.all([
          getInsights(accessToken, adAccountId, { level: "account", timeRange: range }),
          getInsights(accessToken, adAccountId, { level: "account", timeRange: prevRange }),
        ]);
        const cur = aggregateMetrics(curRows);
        const prev = aggregateMetrics(prevRows);
        const changes = {
          spend: pctChange(cur.spend, prev.spend),
          impressions: pctChange(cur.impressions, prev.impressions),
          clicks: pctChange(cur.clicks, prev.clicks),
          ctr: pctChange(cur.ctr, prev.ctr),
          cpa: pctChange(cur.cpa, prev.cpa),
          roas: pctChange(cur.roas, prev.roas),
          conversions: pctChange(cur.conversions, prev.conversions),
        };
        return { range, prevRange, current: cur, previous: prev, changes, syncedAt: Date.now() };
      });
    }),

  /** Daily trend series for charts (spend, clicks, conversions, roas per day). */
  trend: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getInsights(accessToken, adAccountId, {
          level: "account",
          timeRange: range,
          extraParams: { time_increment: "1" },
        });
        const series = rows.map((r) => {
          const m = aggregateMetrics([r]);
          return {
            date: r.date_start ?? r.date_stop ?? "",
            spend: Number(m.spend.toFixed(2)),
            clicks: m.clicks,
            impressions: m.impressions,
            conversions: m.conversions,
            ctr: Number(m.ctr.toFixed(2)),
            roas: Number(m.roas.toFixed(2)),
            cpa: Number(m.cpa.toFixed(2)),
          };
        });
        series.sort((a, b) => a.date.localeCompare(b.date));
        return { series };
      });
    }),

  /** Force-refresh the account summary cache from Meta (returns fresh overview). */
  syncLive: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_7d") }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getInsights(accessToken, adAccountId, { level: "account", timeRange: range });
        const cur = aggregateMetrics(rows);
        return { current: cur, range, syncedAt: Date.now() };
      });
    }),
});
