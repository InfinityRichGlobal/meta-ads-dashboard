import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  DatePreset,
  getAdInsights,
  getAds,
  getCampaignInsights,
  getDateRange,
} from "../metaAdsService";
import { aggregateMetrics, deriveMetrics } from "../../shared/metrics";
import { aiJson, aiText, AI_SYSTEM_THAI } from "../aiUtils";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { deleteDraft, listDrafts, saveDraft } from "../db";

const datePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d"]);

/** Best-effort MIME type detection from a URL or data URL. */
function guessMimeType(url: string): string {
  const dataMatch = url.match(/^data:(.+?);base64,/);
  if (dataMatch) return dataMatch[1];
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

function summarizeAds(ads: any[], insights: any[], limit = 25) {
  const insById = new Map<string, any>();
  for (const i of insights) insById.set(String(i.ad_id), i);
  return ads
    .map((a) => {
      const m = deriveMetrics(insById.get(String(a.id)));
      return {
        id: a.id,
        name: a.name,
        status: a.effective_status ?? a.status,
        spend: Number(m.spend.toFixed(2)),
        impressions: m.impressions,
        clicks: m.clicks,
        ctr: Number(m.ctr.toFixed(2)),
        cpa: Number(m.cpa.toFixed(2)),
        roas: Number(m.roas.toFixed(2)),
        conversions: m.conversions,
      };
    })
    .filter((a) => a.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export const aiRouter = router({
  /** Overall account analysis & recommendations (Thai markdown). */
  recommendations: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_7d") }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ads, insights, campaignIns] = await Promise.all([
          getAds(accessToken, adAccountId),
          getAdInsights(accessToken, adAccountId, range),
          getCampaignInsights(accessToken, adAccountId, range),
        ]);
        const overall = aggregateMetrics(insights);
        const adSummary = summarizeAds(ads, insights);
        const prompt =
          `ช่วงเวลา: ${range.since} ถึง ${range.until}\n\n` +
          `ภาพรวมบัญชี:\n${JSON.stringify(overall, null, 1)}\n\n` +
          `โฆษณาที่ใช้งบสูงสุด:\n${JSON.stringify(adSummary, null, 1)}\n\n` +
          `จำนวนแคมเปญที่มีข้อมูล: ${campaignIns.length}\n\n` +
          `กรุณาวิเคราะห์ภาพรวมประสิทธิภาพ ระบุจุดแข็ง/จุดอ่อน และให้คำแนะนำเชิงปฏิบัติ ` +
          `(เช่น โฆษณาที่ควรปิด/เพิ่มงบ/ปรับ targeting) เป็นข้อ ๆ พร้อมเหตุผลและตัวเลขประกอบ`;
        const analysis = await aiText(AI_SYSTEM_THAI, prompt, 2000);
        return { analysis, overall, range };
      });
    }),

  /** Classify ads into close / monitor / keep with reasons. */
  recommendToClose: protectedProcedure
    .input(z.object({ datePreset: datePresetSchema.default("last_7d") }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ads, insights] = await Promise.all([
          getAds(accessToken, adAccountId),
          getAdInsights(accessToken, adAccountId, range),
        ]);
        const adSummary = summarizeAds(ads, insights, 40);
        const schema = {
          name: "ad_recommendations",
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    adId: { type: "string" },
                    adName: { type: "string" },
                    action: { type: "string", enum: ["close", "monitor", "keep", "scale"] },
                    reason: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["adId", "adName", "action", "reason", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        };
        const result = await aiJson<{ items: any[] }>(
          AI_SYSTEM_THAI +
            " จัดประเภทโฆษณาเป็น close (ควรปิด), monitor (เฝ้าระวัง), keep (คงไว้), scale (เพิ่มงบ) " +
            "พร้อมเหตุผลภาษาไทยและค่าความมั่นใจ 0-1",
          `ข้อมูลโฆษณา (ช่วง ${range.since} ถึง ${range.until}):\n${JSON.stringify(adSummary, null, 1)}`,
          schema,
          2500,
        );
        return { items: result.items ?? [], range };
      });
    }),

  /** Generate new ad copy variations. */
  generateAdCopy: protectedProcedure
    .input(
      z.object({
        product: z.string().min(1),
        tone: z.string().optional(),
        audience: z.string().optional(),
        count: z.number().min(1).max(5).default(3),
      }),
    )
    .mutation(async ({ input }) => {
      const schema = {
        name: "ad_copies",
        schema: {
          type: "object",
          properties: {
            variations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  primaryText: { type: "string" },
                  cta: { type: "string" },
                },
                required: ["headline", "primaryText", "cta"],
                additionalProperties: false,
              },
            },
          },
          required: ["variations"],
          additionalProperties: false,
        },
      };
      const result = await aiJson<{ variations: any[] }>(
        AI_SYSTEM_THAI + " สร้างข้อความโฆษณาภาษาไทยที่ดึงดูดและสอดคล้องกับนโยบาย Meta",
        `สินค้า/บริการ: ${input.product}\nโทน: ${input.tone ?? "เป็นกันเอง น่าเชื่อถือ"}\n` +
          `กลุ่มเป้าหมาย: ${input.audience ?? "ทั่วไป"}\nสร้าง ${input.count} แบบ`,
        schema,
        2000,
      );
      return { variations: result.variations ?? [] };
    }),

  /** Analyze a single ad and propose a new creative concept + image prompt. */
  analyzeForNewCreative: protectedProcedure
    .input(z.object({ adId: z.string(), datePreset: datePresetSchema.default("last_30d") }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      const range = getDateRange(input.datePreset as DatePreset);
      return withMetaErrors(async () => {
        const [ads, insights] = await Promise.all([
          getAds(accessToken, adAccountId),
          getAdInsights(accessToken, adAccountId, range),
        ]);
        const ad = ads.find((a) => String(a.id) === input.adId);
        const ins = insights.find((i) => String(i.ad_id) === input.adId);
        const m = deriveMetrics(ins);
        const schema = {
          name: "new_creative",
          schema: {
            type: "object",
            properties: {
              concept: { type: "string" },
              headline: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
              imagePrompt: { type: "string" },
            },
            required: ["concept", "headline", "body", "cta", "imagePrompt"],
            additionalProperties: false,
          },
        };
        const result = await aiJson<any>(
          AI_SYSTEM_THAI +
            " วิเคราะห์โฆษณาเดิมแล้วเสนอครีเอทีฟใหม่ พร้อม imagePrompt เป็นภาษาอังกฤษสำหรับสร้างภาพ",
          `ชื่อโฆษณาเดิม: ${ad?.name ?? input.adId}\nเมตริก: ${JSON.stringify(m, null, 1)}`,
          schema,
          2000,
        );
        return { ...result, adName: ad?.name ?? null };
      });
    }),

  /** Propose a brand new campaign structure (audience + budget + creative). */
  analyzeForNewCampaign: protectedProcedure
    .input(z.object({ goal: z.string().min(1), product: z.string().min(1), budget: z.number().optional() }))
    .mutation(async ({ input }) => {
      const schema = {
        name: "new_campaign",
        schema: {
          type: "object",
          properties: {
            objective: { type: "string" },
            audience: { type: "string" },
            placements: { type: "string" },
            dailyBudget: { type: "number" },
            headline: { type: "string" },
            body: { type: "string" },
            cta: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: ["objective", "audience", "placements", "dailyBudget", "headline", "body", "cta", "imagePrompt"],
          additionalProperties: false,
        },
      };
      const result = await aiJson<any>(
        AI_SYSTEM_THAI + " เสนอโครงสร้างแคมเปญใหม่ที่สมบูรณ์ imagePrompt เป็นภาษาอังกฤษ",
        `เป้าหมาย: ${input.goal}\nสินค้า: ${input.product}\nงบ/วัน: ${input.budget ?? "ยังไม่กำหนด"}`,
        schema,
        2000,
      );
      return result;
    }),

  /** AI image generation (optionally from a reference/product image). */
  generateAdImage: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(3),
        referenceImageUrl: z.string().optional(),
        referenceMimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const originalImages = input.referenceImageUrl
        ? [{ url: input.referenceImageUrl, mimeType: input.referenceMimeType ?? guessMimeType(input.referenceImageUrl) }]
        : undefined;
      const { url } = await generateImage({ prompt: input.prompt, originalImages });
      if (!url) throw new Error("สร้างภาพไม่สำเร็จ กรุณาลองใหม่");
      return { url };
    }),

  /** Upload a product/reference image (base64) to S3 and return its URL. */
  uploadProductImage: protectedProcedure
    .input(z.object({ dataUrl: z.string().min(10), fileName: z.string().default("product.png") }))
    .mutation(async ({ ctx, input }) => {
      const match = input.dataUrl.match(/^data:(.+?);base64,(.*)$/);
      if (!match) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง ต้องเป็น data URL (base64)");
      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 8 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 8MB");
      const ext = mime.split("/")[1]?.split("+")[0] || "png";
      const key = `${ctx.user.id}-products/${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, mime);
      return { url };
    }),

  /* ---- Drafts persistence ---- */
  saveDraft: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["new_creative", "new_campaign"]),
        adId: z.string().optional(),
        adName: z.string().optional(),
        campaignId: z.string().optional(),
        headline: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
        imageUrl: z.string().optional(),
        imagePrompt: z.string().optional(),
        audienceJson: z.any().optional(),
        budgetJson: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveDraft({
        userId: ctx.user.id,
        mode: input.mode,
        adId: input.adId ?? null,
        adName: input.adName ?? null,
        campaignId: input.campaignId ?? null,
        headline: input.headline ?? null,
        body: input.body ?? null,
        cta: input.cta ?? null,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        audienceJson: input.audienceJson ?? null,
        budgetJson: input.budgetJson ?? null,
      });
      return { ok: true };
    }),

  listDrafts: protectedProcedure.query(async ({ ctx }) => listDrafts(ctx.user.id)),

  deleteDraft: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDraft(ctx.user.id, input.id);
      return { ok: true };
    }),
});
