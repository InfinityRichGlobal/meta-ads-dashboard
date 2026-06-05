/**
 * scheduledHandlers.ts
 * Express handlers for Heartbeat HTTP cron callbacks. All paths under /api/scheduled/*.
 * Each authenticates via sdk.authenticateRequest and looks up the business row by taskUid.
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import {
  getActiveToken,
  getAutoPauseRuleByTaskUid,
  getScheduleByTaskUid,
  getWeeklyReportSettingsByTaskUid,
} from "./db";
import { generateWeeklyReport, runAutoPauseRule, runScheduledSync } from "./automationLogic";
import { notifyOwner } from "./_core/notification";

function errorPayload(err: any, url: string, taskUid?: string) {
  return {
    error: err?.message ?? String(err),
    stack: err?.stack ?? null,
    context: { url, taskUid },
    timestamp: new Date().toISOString(),
  };
}

export async function weeklyReportHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const settings = await getWeeklyReportSettingsByTaskUid(taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const token = await getActiveToken(settings.userId);
    if (!token) return res.json({ ok: true, skipped: "no-token" });
    const report = await generateWeeklyReport(settings.userId, token.accessToken, token.adAccountId);
    await notifyOwner({
      title: "รายงานประจำสัปดาห์ Meta Ads พร้อมแล้ว",
      content: report.aiSummary?.slice(0, 500) ?? "สร้างรายงานสำเร็จ",
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json(errorPayload(err, req.originalUrl, taskUid));
  }
}

export async function autoPauseHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const rule = await getAutoPauseRuleByTaskUid(taskUid);
    if (!rule) return res.json({ ok: true, skipped: "orphan" });
    if (!rule.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await runAutoPauseRule({
      id: rule.id,
      userId: rule.userId,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      minSpend: rule.minSpend,
      level: rule.level,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json(errorPayload(err, req.originalUrl, taskUid));
  }
}

export async function syncDataHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const settings = await getScheduleByTaskUid(taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    if (!settings.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await runScheduledSync(settings.userId, settings.datePreset);
    return res.json({ ...result, ok: true });
  } catch (err) {
    return res.status(500).json(errorPayload(err, req.originalUrl, taskUid));
  }
}
