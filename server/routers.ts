import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { tokenRouter } from "./routers/token";
import { dashboardRouter } from "./routers/dashboard";
import { campaignsRouter } from "./routers/campaigns";
import { adsRouter } from "./routers/ads";
import { aiRouter } from "./routers/ai";
import { breakevenRouter } from "./routers/breakeven";
import { analyticsRouter } from "./routers/analytics";
import { automationRouter } from "./routers/automation";
import { abtestRouter } from "./routers/abtest";
import { audienceRouter } from "./routers/audience";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  token: tokenRouter,
  dashboard: dashboardRouter,
  campaigns: campaignsRouter,
  ads: adsRouter,
  ai: aiRouter,
  breakeven: breakevenRouter,
  analytics: analyticsRouter,
  automation: automationRouter,
  abtest: abtestRouter,
  audience: audienceRouter,
});

export type AppRouter = typeof appRouter;
