import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  DatePreset,
  getAdSetQualityInsights,
  getAgeGenderInsights,
  getCreativeInsights,
  getDateRange,
  getDayHourInsights,
  getDeviceInsights,
  getRegionInsights,
  MESSAGE_ACTION_TYPES,
  PURCHASE_ACTION_TYPES,
  extractActionValue,
} from "../metaAdsService";
import { aggregateMetrics, deriveMetrics, sumActionValue } from "../../shared/metrics";
import { aiText, AI_SYSTEM_THAI } from "../aiUtils";
import {
  createDaypartingSchedule,
  deleteDaypartingSchedule,
  listDaypartingSchedules,
  updateDaypartingSchedule,
} from "../db";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);

export const analyticsRouter = router({
  /* ---------------- Geo (region) ---------------- */
  geo: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getRegionInsights(accessToken, adAccountId, range);
        const regions = rows.map((r) => {
          const m = deriveMetrics(r);
          return {
            region: r.region ?? "Unknown",
            spend: Number(m.spend.toFixed(2)),
            impressions: m.impressions,
            clicks: m.clicks,
            conversions: m.conversions,
            ctr: Number(m.ctr.toFixed(2)),
            cpa: Number(m.cpa.toFixed(2)),
            roas: Number(m.roas.toFixed(2)),
          };
        });
        regions.sort((a, b) => b.spend - a.spend);
        return { regions, range };
      });
    }),

  geoAiAnalyze: protectedProcedure
    .input(z.object({ regions: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI + " วิเคราะห์ประสิทธิภาพโฆษณาตามภูมิภาคของประเทศไทย",
        `ข้อมูลรายภูมิภาค:\n${JSON.stringify(input.regions.slice(0, 30), null, 1)}\n\n` +
          "ระบุภูมิภาคที่ทำผลงานดี/แย่ และแนะนำการจัดสรรงบประมาณ",
        1500,
      );
      return { analysis };
    }),

  /* ---------------- Creative performance ---------------- */
  creative: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getCreativeInsights(accessToken, adAccountId, range);
        const creatives = rows.map((r) => {
          const m = deriveMetrics(r);
          const plays = extractActionValue(r.video_play_actions, ["video_view"]);
          const p25 = extractActionValue(r.video_p25_watched_actions, ["video_view"]);
          const p50 = extractActionValue(r.video_p50_watched_actions, ["video_view"]);
          const p75 = extractActionValue(r.video_p75_watched_actions, ["video_view"]);
          const p100 = extractActionValue(r.video_p100_watched_actions, ["video_view"]);
          const isVideo = plays > 0 || p25 > 0;
          return {
            adId: r.ad_id,
            adName: r.ad_name,
            type: isVideo ? "video" : "image",
            spend: Number(m.spend.toFixed(2)),
            impressions: m.impressions,
            clicks: m.clicks,
            ctr: Number(m.ctr.toFixed(2)),
            roas: Number(m.roas.toFixed(2)),
            conversions: m.conversions,
            retention: isVideo
              ? {
                  p25: plays > 0 ? Number(((p25 / plays) * 100).toFixed(1)) : 0,
                  p50: plays > 0 ? Number(((p50 / plays) * 100).toFixed(1)) : 0,
                  p75: plays > 0 ? Number(((p75 / plays) * 100).toFixed(1)) : 0,
                  p100: plays > 0 ? Number(((p100 / plays) * 100).toFixed(1)) : 0,
                }
              : null,
          };
        });
        creatives.sort((a, b) => b.spend - a.spend);
        return { creatives, range };
      });
    }),

  creativeAiAnalyze: protectedProcedure
    .input(z.object({ creatives: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI + " วิเคราะห์ประสิทธิภาพครีเอทีฟ (รูปภาพ vs วิดีโอ) และอัตราการดูจนจบ",
        `ข้อมูลครีเอทีฟ:\n${JSON.stringify(input.creatives.slice(0, 25), null, 1)}`,
        1500,
      );
      return { analysis };
    }),

  /* ---------------- Audience insights ---------------- */
  audience: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ageGender, device, region] = await Promise.all([
          getAgeGenderInsights(accessToken, adAccountId, range),
          getDeviceInsights(accessToken, adAccountId, range),
          getRegionInsights(accessToken, adAccountId, range),
        ]);
        const ageGenderRows = ageGender.map((r) => {
          const m = deriveMetrics(r);
          return {
            age: r.age,
            gender: r.gender,
            spend: Number(m.spend.toFixed(2)),
            impressions: m.impressions,
            clicks: m.clicks,
            conversions: m.conversions,
            ctr: Number(m.ctr.toFixed(2)),
            cpa: Number(m.cpa.toFixed(2)),
            roas: Number(m.roas.toFixed(2)),
          };
        });
        const deviceRows = device.map((r) => {
          const m = deriveMetrics(r);
          return {
            device: r.device_platform,
            spend: Number(m.spend.toFixed(2)),
            impressions: m.impressions,
            clicks: m.clicks,
            conversions: m.conversions,
            ctr: Number(m.ctr.toFixed(2)),
            roas: Number(m.roas.toFixed(2)),
          };
        });
        const regionRows = region
          .map((r) => {
            const m = deriveMetrics(r);
            return {
              region: r.region ?? "Unknown",
              spend: Number(m.spend.toFixed(2)),
              impressions: m.impressions,
              clicks: m.clicks,
              conversions: m.conversions,
              ctr: Number(m.ctr.toFixed(2)),
              roas: Number(m.roas.toFixed(2)),
            };
          })
          .sort((a, b) => b.spend - a.spend);
        return { ageGender: ageGenderRows, device: deviceRows, region: regionRows, range };
      });
    }),

  audienceAiAnalyze: protectedProcedure
    .input(z.object({ ageGender: z.array(z.any()), device: z.array(z.any()), region: z.array(z.any()).optional() }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI + " วิเคราะห์กลุ่มเป้าหมายตามอายุ เพศ อุปกรณ์ และภูมิภาค พร้อมแนะนำ targeting",
        `อายุ/เพศ:\n${JSON.stringify(input.ageGender, null, 1)}\n\nอุปกรณ์:\n${JSON.stringify(input.device, null, 1)}\n\n` +
          `ภูมิภาค:\n${JSON.stringify((input.region ?? []).slice(0, 20), null, 1)}`,
        1500,
      );
      return { analysis };
    }),

  /* ---------------- Dayparting (7x24 heatmap) ---------------- */
  dayparting: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getDayHourInsights(accessToken, adAccountId, range);
        // Build a true 7x24 grid keyed by day-of-week (0=Sun..6=Sat) and hour (0..23),
        // aggregating raw spend/clicks/conversions across the date range before deriving CPA.
        type Cell = { spend: number; impressions: number; clicks: number; conversions: number };
        const grid: Record<string, Cell> = {};
        for (const r of rows) {
          const key = `${r.dow}-${r.hour}`;
          const m = deriveMetrics(r);
          const cell = (grid[key] ??= { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          cell.spend += m.spend;
          cell.impressions += m.impressions;
          cell.clicks += m.clicks;
          cell.conversions += m.conversions;
        }
        const cells: any[] = [];
        let hourlyMap: Record<number, Cell> = {};
        for (let dow = 0; dow < 7; dow++) {
          for (let hour = 0; hour < 24; hour++) {
            const c = grid[`${dow}-${hour}`] ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
            const cpa = c.conversions > 0 ? c.spend / c.conversions : 0;
            const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
            cells.push({
              dow,
              hour,
              spend: Number(c.spend.toFixed(2)),
              impressions: c.impressions,
              clicks: c.clicks,
              conversions: c.conversions,
              ctr: Number(ctr.toFixed(2)),
              cpa: Number(cpa.toFixed(2)),
            });
            const hm = (hourlyMap[hour] ??= { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
            hm.spend += c.spend;
            hm.impressions += c.impressions;
            hm.clicks += c.clicks;
            hm.conversions += c.conversions;
          }
        }
        const hourly = Object.entries(hourlyMap).map(([hour, c]) => ({
          hour: Number(hour),
          spend: Number(c.spend.toFixed(2)),
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions,
          ctr: c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0,
          cpa: c.conversions > 0 ? Number((c.spend / c.conversions).toFixed(2)) : 0,
        }));
        return { grid: cells, hourly, range };
      });
    }),

  daypartingAiAnalyze: protectedProcedure
    .input(z.object({ hourly: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI + " วิเคราะห์ช่วงเวลาที่โฆษณาทำผลงานดี/แย่ (dayparting) และแนะนำตารางเวลา",
        `ข้อมูลรายชั่วโมง:\n${JSON.stringify(input.hourly, null, 1)}`,
        1500,
      );
      return { analysis };
    }),

  listDaypartingSchedules: protectedProcedure.query(async ({ ctx }) => listDaypartingSchedules(ctx.user.id)),

  createDaypartingSchedule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        campaignId: z.string().optional(),
        scheduleJson: z.any(),
        timezone: z.string().default("Asia/Bangkok"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await createDaypartingSchedule({
        userId: ctx.user.id,
        name: input.name,
        campaignId: input.campaignId ?? null,
        scheduleJson: input.scheduleJson,
        timezone: input.timezone,
      });
      return { ok: true };
    }),

  updateDaypartingSchedule: protectedProcedure
    .input(z.object({ id: z.number(), scheduleJson: z.any().optional(), enabled: z.boolean().optional(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      await updateDaypartingSchedule(ctx.user.id, id, patch as any);
      return { ok: true };
    }),

  deleteDaypartingSchedule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDaypartingSchedule(ctx.user.id, input.id);
      return { ok: true };
    }),

  /* ---------------- Audience Quality Analyzer ---------------- */
  audienceQuality: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_30d") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const rows = await getAdSetQualityInsights(accessToken, adAccountId, range);
        const items = rows.map((r) => {
          const m = deriveMetrics(r);
          const purchases = sumActionValue(r.actions, PURCHASE_ACTION_TYPES);
          const messages = sumActionValue(r.actions, MESSAGE_ACTION_TYPES);
          const link = sumActionValue(r.actions, ["link_click"]);
          // Quality Score formula:
          // weighted blend of purchase rate, buyer-to-chatter ratio and ROAS.
          const buyerRate = messages > 0 ? purchases / messages : purchases > 0 ? 1 : 0;
          const purchaseRate = link > 0 ? purchases / link : 0;
          const roasComponent = Math.min(m.roas / 3, 1); // cap ROAS contribution at 3x
          const qualityScore = Math.round(
            (Math.min(buyerRate, 1) * 40 + Math.min(purchaseRate * 5, 1) * 30 + roasComponent * 30),
          );
          return {
            adsetId: r.adset_id,
            adsetName: r.adset_name,
            campaignName: r.campaign_name,
            spend: Number(m.spend.toFixed(2)),
            purchases,
            messages,
            linkClicks: link,
            buyerToChatterRatio: messages > 0 ? Number(buyerRate.toFixed(2)) : null,
            roas: Number(m.roas.toFixed(2)),
            cpa: Number(m.cpa.toFixed(2)),
            qualityScore,
            funnel: { linkClicks: link, messages, purchases },
          };
        });
        items.sort((a, b) => b.qualityScore - a.qualityScore);
        return { items, range };
      });
    }),

  audienceQualityAiAnalyze: protectedProcedure
    .input(z.object({ items: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI +
          " วิเคราะห์คุณภาพกลุ่มเป้าหมาย (Quality Score, อัตราผู้ซื้อต่อผู้ทัก, funnel) และแนะนำการปรับปรุง",
        `ข้อมูลคุณภาพ adset:\n${JSON.stringify(input.items.slice(0, 25), null, 1)}`,
        1500,
      );
      return { analysis };
    }),
});
