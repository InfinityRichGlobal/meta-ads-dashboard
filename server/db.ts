import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  abTests,
  autoPauseLogs,
  autoPauseRules,
  costItems,
  daypartingSchedules,
  InsertUser,
  metaAdsCache,
  metaAdsetsCache,
  metaAiDrafts,
  metaInsightsCache,
  metaTokenHistory,
  metaTokens,
  scheduleJobLogs,
  scheduleSettings,
  users,
  weeklyReports,
  weeklyReportSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/* ============================================================
 * Users (template baseline)
 * ============================================================ */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ============================================================
 * Meta Tokens
 * ============================================================ */
export async function getActiveToken(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(metaTokens)
    .where(and(eq(metaTokens.userId, userId), eq(metaTokens.status, "active")))
    .orderBy(desc(metaTokens.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTokens(userId: number) {
  const db = await requireDb();
  return db.select().from(metaTokens).where(eq(metaTokens.userId, userId)).orderBy(desc(metaTokens.updatedAt));
}

export async function saveToken(input: {
  userId: number;
  accessToken: string;
  adAccountId: string;
  tokenLabel?: string | null;
  scopes?: string | null;
  expiresAt?: Date | null;
}) {
  const db = await requireDb();
  // Deactivate previous active tokens for the same ad account
  await db
    .update(metaTokens)
    .set({ status: "revoked" })
    .where(and(eq(metaTokens.userId, input.userId), eq(metaTokens.status, "active")));
  const result = await db.insert(metaTokens).values({
    userId: input.userId,
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    tokenLabel: input.tokenLabel ?? null,
    scopes: input.scopes ?? null,
    expiresAt: input.expiresAt ?? null,
    status: "active",
  });
  return result;
}

export async function revokeToken(userId: number, tokenId: number) {
  const db = await requireDb();
  await db
    .update(metaTokens)
    .set({ status: "revoked" })
    .where(and(eq(metaTokens.userId, userId), eq(metaTokens.id, tokenId)));
}

export async function addTokenHistory(input: {
  userId: number;
  action: string;
  tokenLabel?: string | null;
  detail?: string | null;
}) {
  const db = await requireDb();
  await db.insert(metaTokenHistory).values({
    userId: input.userId,
    action: input.action,
    tokenLabel: input.tokenLabel ?? null,
    detail: input.detail ?? null,
  });
}

export async function listTokenHistory(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(metaTokenHistory)
    .where(eq(metaTokenHistory.userId, userId))
    .orderBy(desc(metaTokenHistory.createdAt))
    .limit(50);
}

/* ============================================================
 * Cost items (break-even)
 * ============================================================ */
export async function listCostItems(userId: number) {
  const db = await requireDb();
  return db.select().from(costItems).where(eq(costItems.userId, userId)).orderBy(desc(costItems.createdAt));
}

export async function createCostItem(input: {
  userId: number;
  name: string;
  costPrice: string;
  sellingPrice: string;
  shippingCost: string;
  packingCost: string;
}) {
  const db = await requireDb();
  return db.insert(costItems).values(input);
}

export async function deleteCostItem(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(costItems).where(and(eq(costItems.userId, userId), eq(costItems.id, id)));
}

/* ============================================================
 * AI Drafts
 * ============================================================ */
export async function saveDraft(input: typeof metaAiDrafts.$inferInsert) {
  const db = await requireDb();
  return db.insert(metaAiDrafts).values(input);
}

export async function listDrafts(userId: number) {
  const db = await requireDb();
  return db.select().from(metaAiDrafts).where(eq(metaAiDrafts.userId, userId)).orderBy(desc(metaAiDrafts.createdAt));
}

export async function deleteDraft(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(metaAiDrafts).where(and(eq(metaAiDrafts.userId, userId), eq(metaAiDrafts.id, id)));
}

/* ============================================================
 * Schedule settings + logs
 * ============================================================ */
export async function getScheduleSettings(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(scheduleSettings).where(eq(scheduleSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertScheduleSettings(
  userId: number,
  patch: Partial<typeof scheduleSettings.$inferInsert>,
) {
  const db = await requireDb();
  const existing = await getScheduleSettings(userId);
  if (existing) {
    await db.update(scheduleSettings).set(patch).where(eq(scheduleSettings.userId, userId));
    return getScheduleSettings(userId);
  }
  await db.insert(scheduleSettings).values({ userId, ...patch });
  return getScheduleSettings(userId);
}

export async function getScheduleByTaskUid(taskUid: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(scheduleSettings)
    .where(eq(scheduleSettings.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function addScheduleJobLog(input: typeof scheduleJobLogs.$inferInsert) {
  const db = await requireDb();
  return db.insert(scheduleJobLogs).values(input);
}

export async function listScheduleJobLogs(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(scheduleJobLogs)
    .where(eq(scheduleJobLogs.userId, userId))
    .orderBy(desc(scheduleJobLogs.runAt))
    .limit(50);
}

/* ============================================================
 * Auto-pause rules + logs
 * ============================================================ */
export async function listAutoPauseRules(userId: number) {
  const db = await requireDb();
  return db.select().from(autoPauseRules).where(eq(autoPauseRules.userId, userId)).orderBy(desc(autoPauseRules.createdAt));
}

export async function createAutoPauseRule(input: typeof autoPauseRules.$inferInsert) {
  const db = await requireDb();
  const res = await db.insert(autoPauseRules).values(input);
  return res;
}

export async function getAutoPauseRule(userId: number, id: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(autoPauseRules)
    .where(and(eq(autoPauseRules.userId, userId), eq(autoPauseRules.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAutoPauseRuleByTaskUid(taskUid: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(autoPauseRules)
    .where(eq(autoPauseRules.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateAutoPauseRule(
  userId: number,
  id: number,
  patch: Partial<typeof autoPauseRules.$inferInsert>,
) {
  const db = await requireDb();
  await db.update(autoPauseRules).set(patch).where(and(eq(autoPauseRules.userId, userId), eq(autoPauseRules.id, id)));
}

export async function deleteAutoPauseRule(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(autoPauseRules).where(and(eq(autoPauseRules.userId, userId), eq(autoPauseRules.id, id)));
}

export async function addAutoPauseLog(input: typeof autoPauseLogs.$inferInsert) {
  const db = await requireDb();
  return db.insert(autoPauseLogs).values(input);
}

export async function listAutoPauseLogs(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(autoPauseLogs)
    .where(eq(autoPauseLogs.userId, userId))
    .orderBy(desc(autoPauseLogs.runAt))
    .limit(50);
}

/* ============================================================
 * Weekly reports
 * ============================================================ */
export async function saveWeeklyReport(input: typeof weeklyReports.$inferInsert) {
  const db = await requireDb();
  return db.insert(weeklyReports).values(input);
}

export async function listWeeklyReports(userId: number) {
  const db = await requireDb();
  return db.select().from(weeklyReports).where(eq(weeklyReports.userId, userId)).orderBy(desc(weeklyReports.createdAt)).limit(30);
}

export async function getWeeklyReportSettings(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(weeklyReportSettings).where(eq(weeklyReportSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertWeeklyReportSettings(
  userId: number,
  patch: Partial<typeof weeklyReportSettings.$inferInsert>,
) {
  const db = await requireDb();
  const existing = await getWeeklyReportSettings(userId);
  if (existing) {
    await db.update(weeklyReportSettings).set(patch).where(eq(weeklyReportSettings.userId, userId));
    return getWeeklyReportSettings(userId);
  }
  await db.insert(weeklyReportSettings).values({ userId, ...patch });
  return getWeeklyReportSettings(userId);
}

export async function getWeeklyReportSettingsByTaskUid(taskUid: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(weeklyReportSettings)
    .where(eq(weeklyReportSettings.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0] ?? null;
}

/* ============================================================
 * A/B Tests
 * ============================================================ */
export async function saveAbTest(input: typeof abTests.$inferInsert) {
  const db = await requireDb();
  return db.insert(abTests).values(input);
}

export async function listAbTests(userId: number) {
  const db = await requireDb();
  return db.select().from(abTests).where(eq(abTests.userId, userId)).orderBy(desc(abTests.createdAt)).limit(50);
}

export async function deleteAbTest(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(abTests).where(and(eq(abTests.userId, userId), eq(abTests.id, id)));
}

/* ============================================================
 * Dayparting schedules
 * ============================================================ */
export async function listDaypartingSchedules(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(daypartingSchedules)
    .where(eq(daypartingSchedules.userId, userId))
    .orderBy(desc(daypartingSchedules.createdAt));
}

export async function createDaypartingSchedule(input: typeof daypartingSchedules.$inferInsert) {
  const db = await requireDb();
  return db.insert(daypartingSchedules).values(input);
}

export async function updateDaypartingSchedule(
  userId: number,
  id: number,
  patch: Partial<typeof daypartingSchedules.$inferInsert>,
) {
  const db = await requireDb();
  await db
    .update(daypartingSchedules)
    .set(patch)
    .where(and(eq(daypartingSchedules.userId, userId), eq(daypartingSchedules.id, id)));
}

export async function deleteDaypartingSchedule(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(daypartingSchedules).where(and(eq(daypartingSchedules.userId, userId), eq(daypartingSchedules.id, id)));
}

/* ============================================================
 * Insights / data caches
 * ============================================================ */

export async function putInsightsCache(input: typeof metaInsightsCache.$inferInsert) {
  const db = await requireDb();
  return db.insert(metaInsightsCache).values(input);
}

export async function getInsightsCache(userId: number, cacheKey: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(metaInsightsCache)
    .where(and(eq(metaInsightsCache.userId, userId), eq(metaInsightsCache.cacheKey, cacheKey)))
    .orderBy(desc(metaInsightsCache.syncedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function putAdsCache(userId: number, adAccountId: string, data: unknown) {
  const db = await requireDb();
  await db.delete(metaAdsCache).where(eq(metaAdsCache.userId, userId));
  return db.insert(metaAdsCache).values({ userId, adAccountId, data: data as any });
}

export async function getAdsCache(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(metaAdsCache)
    .where(eq(metaAdsCache.userId, userId))
    .orderBy(desc(metaAdsCache.syncedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function putAdsetsCache(userId: number, adAccountId: string, data: unknown) {
  const db = await requireDb();
  await db.delete(metaAdsetsCache).where(eq(metaAdsetsCache.userId, userId));
  return db.insert(metaAdsetsCache).values({ userId, adAccountId, data: data as any });
}

export async function getAdsetsCache(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(metaAdsetsCache)
    .where(eq(metaAdsetsCache.userId, userId))
    .orderBy(desc(metaAdsetsCache.syncedAt))
    .limit(1);
  return rows[0] ?? null;
}
