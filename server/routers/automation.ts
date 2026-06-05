import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createHeartbeatJob,
  deleteHeartbeatJob,
  updateHeartbeatJob,
} from "../_core/heartbeat";
import {
  createAutoPauseRule,
  deleteAutoPauseRule,
  getAutoPauseRule,
  getScheduleSettings,
  getWeeklyReportSettings,
  listAutoPauseLogs,
  listAutoPauseRules,
  listScheduleJobLogs,
  listWeeklyReports,
  updateAutoPauseRule,
  upsertScheduleSettings,
  upsertWeeklyReportSettings,
} from "../db";
import { generateWeeklyReport } from "../automationLogic";
import { resolveToken } from "./_helpers";

function sessionTokenFrom(ctx: any): string {
  return parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
}

const cronField = z.string().regex(/^(\S+\s+){5}\S+$/, "ต้องเป็น cron 6 ช่อง");

export const automationRouter = router({
  /* ---------------- Weekly report ---------------- */
  weeklyReportSettings: protectedProcedure.query(async ({ ctx }) => getWeeklyReportSettings(ctx.user.id)),

  listWeeklyReports: protectedProcedure.query(async ({ ctx }) => listWeeklyReports(ctx.user.id)),

  /** Generate a weekly report on demand (inline LLM, no cron needed). */
  generateWeeklyNow: protectedProcedure.mutation(async ({ ctx }) => {
    const { accessToken, adAccountId } = await resolveToken(ctx.user.id);
    const report = await generateWeeklyReport(ctx.user.id, accessToken, adAccountId);
    return report;
  }),

  /** Enable/disable scheduled weekly report (Heartbeat HTTP cron). */
  setWeeklySchedule: protectedProcedure
    .input(z.object({ enabled: z.boolean(), cron: cronField.default("0 0 1 * * 1") }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const existing = await getWeeklyReportSettings(ctx.user.id);
      if (input.enabled) {
        if (existing?.scheduleCronTaskUid) {
          await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: input.cron, enable: true }, sessionToken);
          await upsertWeeklyReportSettings(ctx.user.id, { enabled: true, cron: input.cron });
        } else {
          const job = await createHeartbeatJob(
            {
              name: `weekly-report-${ctx.user.id}`,
              cron: input.cron,
              path: "/api/scheduled/weeklyReport",
              payload: { userId: ctx.user.id },
              description: `Weekly Meta Ads report for user ${ctx.user.id}`,
            },
            sessionToken,
          );
          await upsertWeeklyReportSettings(ctx.user.id, {
            enabled: true,
            cron: input.cron,
            scheduleCronTaskUid: job.taskUid,
          });
        }
      } else if (existing?.scheduleCronTaskUid) {
        await updateHeartbeatJob(existing.scheduleCronTaskUid, { enable: false }, sessionToken);
        await upsertWeeklyReportSettings(ctx.user.id, { enabled: false });
      } else {
        await upsertWeeklyReportSettings(ctx.user.id, { enabled: false, cron: input.cron });
      }
      return { ok: true };
    }),

  /* ---------------- Generic scheduled sync ---------------- */
  scheduleSettings: protectedProcedure.query(async ({ ctx }) => getScheduleSettings(ctx.user.id)),
  scheduleLogs: protectedProcedure.query(async ({ ctx }) => listScheduleJobLogs(ctx.user.id)),

  setSyncSchedule: protectedProcedure
    .input(z.object({ enabled: z.boolean(), cron: cronField.default("0 0 */6 * * *") }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const existing = await getScheduleSettings(ctx.user.id);
      if (input.enabled) {
        if (existing?.scheduleCronTaskUid) {
          await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: input.cron, enable: true }, sessionToken);
          await upsertScheduleSettings(ctx.user.id, { enabled: true, cron: input.cron });
        } else {
          const job = await createHeartbeatJob(
            {
              name: `sync-${ctx.user.id}`,
              cron: input.cron,
              path: "/api/scheduled/syncData",
              payload: { userId: ctx.user.id },
              description: `Scheduled Meta Ads data sync for user ${ctx.user.id}`,
            },
            sessionToken,
          );
          await upsertScheduleSettings(ctx.user.id, {
            enabled: true,
            cron: input.cron,
            scheduleCronTaskUid: job.taskUid,
          });
        }
      } else if (existing?.scheduleCronTaskUid) {
        await updateHeartbeatJob(existing.scheduleCronTaskUid, { enable: false }, sessionToken);
        await upsertScheduleSettings(ctx.user.id, { enabled: false });
      } else {
        await upsertScheduleSettings(ctx.user.id, { enabled: false, cron: input.cron });
      }
      return { ok: true };
    }),

  /* ---------------- Auto-pause rules ---------------- */
  listAutoPauseRules: protectedProcedure.query(async ({ ctx }) => listAutoPauseRules(ctx.user.id)),
  autoPauseLogs: protectedProcedure.query(async ({ ctx }) => listAutoPauseLogs(ctx.user.id)),

  createAutoPauseRule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        metric: z.enum(["cpa", "roas", "ctr", "spend"]),
        operator: z.enum(["gt", "lt", "gte", "lte"]),
        threshold: z.number(),
        minSpend: z.number().default(0),
        level: z.enum(["ad", "adset", "campaign"]).default("ad"),
        cron: cronField.default("0 0 */3 * * *"),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const res = await createAutoPauseRule({
        userId: ctx.user.id,
        name: input.name,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold.toString(),
        minSpend: input.minSpend.toString(),
        level: input.level,
        cron: input.cron,
        enabled: input.enabled,
      });
      const ruleId = (res as any).insertId ?? (res as any)[0]?.insertId;
      if (input.enabled && ruleId) {
        const job = await createHeartbeatJob(
          {
            name: `autopause-${ctx.user.id}-${ruleId}`,
            cron: input.cron,
            path: "/api/scheduled/autoPause",
            payload: { ruleId },
            description: `Auto-pause rule "${input.name}"`,
          },
          sessionToken,
        );
        await updateAutoPauseRule(ctx.user.id, Number(ruleId), { scheduleCronTaskUid: job.taskUid });
      }
      return { ok: true };
    }),

  toggleAutoPauseRule: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const rule = await getAutoPauseRule(ctx.user.id, input.id);
      if (!rule) return { ok: false };
      if (rule.scheduleCronTaskUid) {
        await updateHeartbeatJob(rule.scheduleCronTaskUid, { enable: input.enabled }, sessionToken);
      }
      await updateAutoPauseRule(ctx.user.id, input.id, { enabled: input.enabled });
      return { ok: true };
    }),

  /** Full edit of an existing rule's fields, resyncing the heartbeat job if cron/enable changes. */
  updateAutoPauseRule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        metric: z.enum(["cpa", "roas", "ctr", "spend"]).optional(),
        operator: z.enum(["gt", "lt", "gte", "lte"]).optional(),
        threshold: z.number().optional(),
        minSpend: z.number().optional(),
        level: z.enum(["ad", "adset", "campaign"]).optional(),
        cron: cronField.optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const rule = await getAutoPauseRule(ctx.user.id, input.id);
      if (!rule) return { ok: false };
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.metric !== undefined) patch.metric = input.metric;
      if (input.operator !== undefined) patch.operator = input.operator;
      if (input.threshold !== undefined) patch.threshold = input.threshold.toString();
      if (input.minSpend !== undefined) patch.minSpend = input.minSpend.toString();
      if (input.level !== undefined) patch.level = input.level;
      if (input.cron !== undefined) patch.cron = input.cron;
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      await updateAutoPauseRule(ctx.user.id, input.id, patch as any);

      // Resync heartbeat job if cron or enabled changed and a job exists.
      if (rule.scheduleCronTaskUid && (input.cron !== undefined || input.enabled !== undefined)) {
        const upd: { cron?: string; enable?: boolean } = {};
        if (input.cron !== undefined) upd.cron = input.cron;
        if (input.enabled !== undefined) upd.enable = input.enabled;
        try {
          await updateHeartbeatJob(rule.scheduleCronTaskUid, upd, sessionToken);
        } catch {
          /* ignore */
        }
      }
      return { ok: true };
    }),

  deleteAutoPauseRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = sessionTokenFrom(ctx);
      const rule = await getAutoPauseRule(ctx.user.id, input.id);
      if (rule?.scheduleCronTaskUid) {
        try {
          await deleteHeartbeatJob(rule.scheduleCronTaskUid, sessionToken);
        } catch {
          /* ignore */
        }
      }
      await deleteAutoPauseRule(ctx.user.id, input.id);
      return { ok: true };
    }),
});
