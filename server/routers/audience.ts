import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { resolveToken, withMetaErrors } from "./_helpers";
import {
  searchTargetingInterests,
  browseTargetingCategories,
  estimateAudienceSize,
} from "../metaAdsService";
import { aiText, AI_SYSTEM_THAI } from "../aiUtils";

export const audienceRouter = router({
  searchInterests: protectedProcedure
    .input(z.object({ query: z.string().min(1), locale: z.string().default("th_TH") }))
    .query(async ({ ctx, input }) => {
      const { accessToken } = await resolveToken(ctx.user.id);
      return withMetaErrors(async () => {
        const results = await searchTargetingInterests(accessToken, input.query, input.locale);
        return results.map((r: any) => ({
          id: r.id,
          name: r.name,
          audienceSizeLowerBound: r.audience_size_lower_bound ?? 0,
          audienceSizeUpperBound: r.audience_size_upper_bound ?? 0,
          path: r.path ?? [],
          topic: r.topic ?? "",
          description: r.description ?? "",
        }));
      });
    }),

  browseCategories: protectedProcedure
    .input(z.object({ type: z.enum(["interests", "behaviors"]).default("interests") }))
    .query(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      return withMetaErrors(async () => {
        const results = await browseTargetingCategories(accessToken, adAccountId, input.type);
        return results.map((r: any) => ({
          id: r.id,
          name: r.name,
          audienceSizeLowerBound: r.audience_size_lower_bound ?? 0,
          audienceSizeUpperBound: r.audience_size_upper_bound ?? 0,
          path: r.path ?? [],
          description: r.description ?? "",
        }));
      });
    }),

  estimateSize: protectedProcedure
    .input(z.object({
      geoLocations: z.object({ countries: z.array(z.string()).optional() }).optional(),
      ageMin: z.number().min(18).max(65).default(18),
      ageMax: z.number().min(18).max(65).default(65),
      genders: z.array(z.number()).optional(),
      interests: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
      return withMetaErrors(async () => {
        const spec: Record<string, any> = { age_min: input.ageMin, age_max: input.ageMax };
        if (input.geoLocations) spec.geo_locations = input.geoLocations;
        if (input.genders?.length) spec.genders = input.genders;
        if (input.interests?.length) spec.interests = input.interests;
        return await estimateAudienceSize(accessToken, adAccountId, spec);
      });
    }),

  aiSuggestTargeting: protectedProcedure
    .input(z.object({ productDescription: z.string().min(10), targetCountries: z.array(z.string()).default(["TH"]) }))
    .mutation(async ({ input }) => {
      const analysis = await aiText(
        AI_SYSTEM_THAI + " คุณเป็นผู้เชี่ยวชาญ Facebook Ads Targeting",
        `สินค้า/บริการ: ${input.productDescription}\nประเทศเป้าหมาย: ${input.targetCountries.join(", ")}\n\n` +
          "แนะนำ Facebook Targeting ที่เหมาะสม:\n" +
          "1. กลุ่มความสนใจ (Interests) 5-10 รายการ\n" +
          "2. พฤติกรรม (Behaviors) 3-5 รายการ\n" +
          "3. ช่วงอายุและเพศที่เหมาะสม\n" +
          "4. Custom Audience แนะนำ\n" +
          "5. Lookalike Audience strategy\n\n" +
          "ตอบเป็นภาษาไทย พร้อมอธิบายเหตุผลสั้นๆ",
        2000,
      );
      return { analysis };
    }),
});
