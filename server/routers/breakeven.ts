import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createCostItem, deleteCostItem, listCostItems } from "../db";

export function computeBreakeven(item: {
  costPrice: number;
  sellingPrice: number;
  shippingCost: number;
  packingCost: number;
}) {
  const totalCost = item.costPrice + item.shippingCost + item.packingCost;
  const grossProfit = item.sellingPrice - totalCost; // profit available to spend on ads at break-even
  const profitMargin = item.sellingPrice > 0 ? (grossProfit / item.sellingPrice) * 100 : 0;
  // Break-even ROAS = revenue / ad-spend where ad-spend == grossProfit per sale
  const breakevenRoas = grossProfit > 0 ? item.sellingPrice / grossProfit : Infinity;
  // Max allowable CPA at break-even = grossProfit per conversion
  const maxCpa = grossProfit;
  // Target ROAS at common margin goals
  const targetRoas20 = grossProfit > 0 ? item.sellingPrice / (grossProfit - item.sellingPrice * 0.2) : Infinity;
  return {
    totalCost,
    grossProfit,
    profitMargin,
    breakevenRoas: isFinite(breakevenRoas) ? Number(breakevenRoas.toFixed(2)) : null,
    maxCpa: Number(maxCpa.toFixed(2)),
    targetRoas20: isFinite(targetRoas20) && targetRoas20 > 0 ? Number(targetRoas20.toFixed(2)) : null,
  };
}

export const breakevenRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await listCostItems(ctx.user.id);
    return items.map((it) => {
      const calc = computeBreakeven({
        costPrice: Number(it.costPrice),
        sellingPrice: Number(it.sellingPrice),
        shippingCost: Number(it.shippingCost),
        packingCost: Number(it.packingCost),
      });
      return { ...it, calc };
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        costPrice: z.number().nonnegative(),
        sellingPrice: z.number().nonnegative(),
        shippingCost: z.number().nonnegative().default(0),
        packingCost: z.number().nonnegative().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await createCostItem({
        userId: ctx.user.id,
        name: input.name,
        costPrice: input.costPrice.toFixed(2),
        sellingPrice: input.sellingPrice.toFixed(2),
        shippingCost: input.shippingCost.toFixed(2),
        packingCost: input.packingCost.toFixed(2),
      });
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCostItem(ctx.user.id, input.id);
      return { ok: true };
    }),

  /** Pure calculator (no persistence) for the live preview UI. */
  calc: protectedProcedure
    .input(
      z.object({
        costPrice: z.number(),
        sellingPrice: z.number(),
        shippingCost: z.number().default(0),
        packingCost: z.number().default(0),
      }),
    )
    .query(({ input }) => computeBreakeven(input)),
});
