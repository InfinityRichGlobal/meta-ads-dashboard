/**
 * automationLogic.ts
 * Shared business logic for weekly reports and auto-pause checks.
 * Used by both tRPC procedures (on-demand) and /api/scheduled/* cron handlers.
 */
import {
  getAdInsights,
  getAds,
  getDateRange,
  getInsights,
  getPreviousPeriodRange,
  TimeRange,
  updateAdStatus,
} from "./metaAdsService";
import { aggregateMetrics, deriveMetrics, pctChange } from "../shared/metrics";
import { aiText, AI_SYSTEM_THAI } from "./aiUtils";
import {
  addAutoPauseLog,
  addScheduleJobLog,
  getActiveToken,
  saveWeeklyReport,
} from "./db";
import { notifyOwner } from "./_core/notification";

/* ---------------- Weekly report ---------------- */
export async function generateWeeklyReport(userId: number, accessToken: string, adAccountId: string) {
  const range = getDateRange("last_7d");
  const prevRange = getPreviousPeriodRange(range);
  const [curRows, prevRows, ads, adIns] = await Promise.all([
    getInsights(accessToken, adAccountId, { level: "account", timeRange: range }),
    getInsights(accessToken, adAccountId, { level: "account", timeRange: prevRange }),
    getAds(accessToken, adAccountId),
    getAdInsights(accessToken, adAccountId, range),
  ]);
  const cur = aggregateMetrics(curRows);
  const prev = aggregateMetrics(prevRows);

  const insById = new Map<string, any>();
  for (const i of adIns) insById.set(String(i.ad_id), i);
  const topAds = ads
    .map((a) => {
      const m = deriveMetrics(insById.get(String(a.id)));
      return { name: a.name, spend: m.spend, roas: m.roas, conversions: m.conversions, ctr: m.ctr };
    })
    .filter((a) => a.spend > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 5);

  const changes = {
    spend: pctChange(cur.spend, prev.spend),
    conversions: pctChange(cur.conversions, prev.conversions),
    roas: pctChange(cur.roas, prev.roas),
    ctr: pctChange(cur.ctr, prev.ctr),
    cpa: pctChange(cur.cpa, prev.cpa),
  };

  const aiSummary = await aiText(
    AI_SYSTEM_THAI + " เขียนสรุปรายงานประจำสัปดาห์ที่กระชับ มีหัวข้อ และข้อเสนอแนะ",
    `ช่วง ${range.since} ถึง ${range.until}\n\nสัปดาห์นี้:\n${JSON.stringify(cur, null, 1)}\n\n` +
      `สัปดาห์ก่อน:\n${JSON.stringify(prev, null, 1)}\n\n% เปลี่ยนแปลง:\n${JSON.stringify(changes, null, 1)}\n\n` +
      `Top 5 โฆษณา (ROAS):\n${JSON.stringify(topAds, null, 1)}`,
    2000,
  );

  const data = { current: cur, previous: prev, changes, topAds };
  await saveWeeklyReport({
    userId,
    adAccountId,
    weekStart: range.since,
    weekEnd: range.until,
    data: data as any,
    aiSummary,
  });
  return { range, ...data, aiSummary };
}

/* ---------------- Auto-pause check ---------------- */
type Rule = {
  id: number;
  userId: number;
  metric: string;
  operator: string;
  threshold: string | number;
  minSpend: string | number;
  level: string;
};

function compare(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

export async function runAutoPauseRule(rule: Rule) {
  const token = await getActiveToken(rule.userId);
  if (!token) {
    await addAutoPauseLog({
      ruleId: rule.id,
      userId: rule.userId,
      status: "skipped",
      adsChecked: 0,
      matchedCount: 0,
      notificationSent: false,
      detail: "ไม่มี active token",
    });
    return { matched: 0, paused: 0 };
  }
  const range = getDateRange("last_7d");
  const [ads, insights] = await Promise.all([
    getAds(token.accessToken, token.adAccountId),
    getAdInsights(token.accessToken, token.adAccountId, range),
  ]);
  const insById = new Map<string, any>();
  for (const i of insights) insById.set(String(i.ad_id), i);

  const threshold = Number(rule.threshold);
  const minSpend = Number(rule.minSpend);
  const matched: string[] = [];

  for (const ad of ads) {
    if ((ad.effective_status ?? ad.status) !== "ACTIVE") continue;
    const m = deriveMetrics(insById.get(String(ad.id)));
    if (m.spend < minSpend) continue;
    const metricValue =
      rule.metric === "cpa" ? m.cpa : rule.metric === "roas" ? m.roas : rule.metric === "ctr" ? m.ctr : m.spend;
    if (compare(metricValue, rule.operator, threshold)) matched.push(ad.id);
  }

  let paused = 0;
  for (const adId of matched) {
    try {
      await updateAdStatus(token.accessToken, adId, "PAUSED");
      paused++;
    } catch {
      /* ignore individual failures */
    }
  }

  const notified = matched.length > 0;
  if (notified) {
    await notifyOwner({
      title: `Auto-Pause: ปิดโฆษณา ${paused} รายการ`,
      content: `กฎ #${rule.id} (${rule.metric} ${rule.operator} ${threshold}) ปิดโฆษณา ${paused}/${matched.length} รายการ`,
    });
  }
  await addAutoPauseLog({
    ruleId: rule.id,
    userId: rule.userId,
    status: "success",
    adsChecked: ads.length,
    matchedCount: matched.length,
    notificationSent: notified,
    detail: `ปิด ${paused} จาก ${matched.length} ที่เข้าเงื่อนไข`,
  });
  return { matched: matched.length, paused };
}

/* ---------------- Scheduled data sync / health check ---------------- */
export async function runScheduledSync(userId: number, datePreset: string) {
  const token = await getActiveToken(userId);
  if (!token) {
    await addScheduleJobLog({
      userId,
      status: "skipped",
      adsChecked: 0,
      underperformingCount: 0,
      notificationSent: false,
      detail: "ไม่มี active token",
    });
    return { ok: false };
  }
  const range = getDateRange((datePreset as any) || "last_7d");
  const [ads, insights] = await Promise.all([
    getAds(token.accessToken, token.adAccountId),
    getAdInsights(token.accessToken, token.adAccountId, range as TimeRange),
  ]);
  const insById = new Map<string, any>();
  for (const i of insights) insById.set(String(i.ad_id), i);
  let underperforming = 0;
  for (const ad of ads) {
    const m = deriveMetrics(insById.get(String(ad.id)));
    if (m.spend > 0 && m.roas > 0 && m.roas < 1) underperforming++;
  }
  const notify = underperforming > 0;
  if (notify) {
    await notifyOwner({
      title: `ตรวจสอบโฆษณาประจำ: พบ ${underperforming} โฆษณาน่ากังวล`,
      content: `มีโฆษณา ${underperforming} รายการที่ ROAS < 1 ในช่วง ${range.since} - ${range.until}`,
    });
  }
  await addScheduleJobLog({
    userId,
    status: "success",
    adsChecked: ads.length,
    underperformingCount: underperforming,
    notificationSent: notify,
    detail: `ตรวจสอบ ${ads.length} โฆษณา พบ ${underperforming} รายการน่ากังวล`,
  });
  return { ok: true, adsChecked: ads.length, underperforming };
}
