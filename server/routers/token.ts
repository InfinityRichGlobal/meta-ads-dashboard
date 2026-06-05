import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  addTokenHistory,
  getActiveToken,
  listTokenHistory,
  listTokens,
  revokeToken,
  saveToken,
} from "../db";
import { parseMetaApiError, validateToken } from "../metaAdsService";

export const tokenRouter = router({
  /** Current active token (token text masked). */
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const t = await getActiveToken(ctx.user.id);
    if (!t) return null;
    return {
      id: t.id,
      adAccountId: t.adAccountId,
      tokenLabel: t.tokenLabel,
      scopes: t.scopes ? t.scopes.split(",").map((s) => s.trim()).filter(Boolean) : [],
      status: t.status,
      expiresAt: t.expiresAt,
      maskedToken: t.accessToken.slice(0, 8) + "..." + t.accessToken.slice(-4),
      updatedAt: t.updatedAt,
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listTokens(ctx.user.id);
    return rows.map((t) => ({
      id: t.id,
      adAccountId: t.adAccountId,
      tokenLabel: t.tokenLabel,
      status: t.status,
      expiresAt: t.expiresAt,
      maskedToken: t.accessToken.slice(0, 8) + "..." + t.accessToken.slice(-4),
      createdAt: t.createdAt,
    }));
  }),

  history: protectedProcedure.query(async ({ ctx }) => listTokenHistory(ctx.user.id)),

  /** Test a token without saving — returns user id, scopes, expiry. */
  test: protectedProcedure
    .input(z.object({ accessToken: z.string().min(10), adAccountId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const info = await validateToken(input.accessToken);
        return {
          ok: true as const,
          userId: info.id,
          userName: info.name,
          scopes: info.scopes ?? [],
          expiresAt: info.expiresAt ?? null,
        };
      } catch (err: any) {
        const parsed = parseMetaApiError(err?.info ? { error: { code: err.info.code } } : err);
        return { ok: false as const, error: err?.message ?? parsed.message };
      }
    }),

  /** Validate then persist a token (deactivates the previous active one). */
  save: protectedProcedure
    .input(
      z.object({
        accessToken: z.string().min(10),
        adAccountId: z.string().min(1),
        tokenLabel: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const info = await validateToken(input.accessToken);
      await saveToken({
        userId: ctx.user.id,
        accessToken: input.accessToken,
        adAccountId: input.adAccountId,
        tokenLabel: input.tokenLabel ?? null,
        scopes: info.scopes?.join(",") ?? null,
        expiresAt: info.expiresAt ? new Date(info.expiresAt) : null,
      });
      await addTokenHistory({
        userId: ctx.user.id,
        action: "save",
        tokenLabel: input.tokenLabel ?? null,
        detail: `Connected ad account ${input.adAccountId}`,
      });
      return { ok: true, scopes: info.scopes ?? [], expiresAt: info.expiresAt ?? null };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await revokeToken(ctx.user.id, input.id);
      await addTokenHistory({ userId: ctx.user.id, action: "revoke", detail: `Revoked token #${input.id}` });
      return { ok: true };
    }),
});
