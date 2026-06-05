import { boolean, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ============================================================
 * Meta Token management
 * ============================================================ */
export const metaTokens = mysqlTable("meta_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessToken: text("accessToken").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  tokenLabel: varchar("tokenLabel", { length: 128 }),
  scopes: text("scopes"),
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaToken = typeof metaTokens.$inferSelect;

export const metaTokenHistory = mysqlTable("meta_token_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  tokenLabel: varchar("tokenLabel", { length: 128 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MetaTokenHistory = typeof metaTokenHistory.$inferSelect;

/* ============================================================
 * Insights / data caches
 * ============================================================ */
export const metaInsightsCache = mysqlTable("meta_insights_cache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  datePreset: varchar("datePreset", { length: 32 }).notNull(),
  level: varchar("level", { length: 16 }).notNull(),
  cacheKey: varchar("cacheKey", { length: 128 }).notNull(),
  data: json("data"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type MetaInsightsCache = typeof metaInsightsCache.$inferSelect;

export const metaAdsCache = mysqlTable("meta_ads_cache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  data: json("data"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type MetaAdsCache = typeof metaAdsCache.$inferSelect;

export const metaAdsetsCache = mysqlTable("meta_adsets_cache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  data: json("data"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type MetaAdsetsCache = typeof metaAdsetsCache.$inferSelect;

/* ============================================================
 * Break-even cost items
 * ============================================================ */
export const costItems = mysqlTable("cost_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  costPrice: decimal("costPrice", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal("sellingPrice", { precision: 12, scale: 2 }).notNull(),
  shippingCost: decimal("shippingCost", { precision: 12, scale: 2 }).default("0").notNull(),
  packingCost: decimal("packingCost", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CostItem = typeof costItems.$inferSelect;

/* ============================================================
 * AI drafts
 * ============================================================ */
export const metaAiDrafts = mysqlTable("meta_ai_drafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adId: varchar("adId", { length: 64 }),
  adName: varchar("adName", { length: 255 }),
  campaignId: varchar("campaignId", { length: 64 }),
  mode: mysqlEnum("mode", ["new_creative", "new_campaign"]).default("new_creative").notNull(),
  headline: text("headline"),
  body: text("body"),
  cta: varchar("cta", { length: 64 }),
  imageUrl: text("imageUrl"),
  imagePrompt: text("imagePrompt"),
  audienceJson: json("audienceJson"),
  budgetJson: json("budgetJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MetaAiDraft = typeof metaAiDrafts.$inferSelect;

/* ============================================================
 * Automation: scheduled checks + auto-pause rules
 * ============================================================ */
export const scheduleSettings = mysqlTable("schedule_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  cron: varchar("cron", { length: 64 }).default("0 0 */6 * * *").notNull(),
  checkHour: int("checkHour").default(8).notNull(),
  checkMinute: int("checkMinute").default(0).notNull(),
  datePreset: varchar("datePreset", { length: 32 }).default("last_7d").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ScheduleSetting = typeof scheduleSettings.$inferSelect;

export const scheduleJobLogs = mysqlTable("schedule_job_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  runAt: timestamp("runAt").defaultNow().notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  adsChecked: int("adsChecked").default(0).notNull(),
  underperformingCount: int("underperformingCount").default(0).notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  detail: text("detail"),
});
export type ScheduleJobLog = typeof scheduleJobLogs.$inferSelect;

export const autoPauseRules = mysqlTable("auto_pause_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  metric: mysqlEnum("metric", ["cpa", "ctr", "spend", "frequency", "roas"]).notNull(),
  operator: mysqlEnum("operator", ["gt", "lt", "gte", "lte"]).notNull(),
  threshold: decimal("threshold", { precision: 12, scale: 2 }).notNull(),
  minSpend: decimal("minSpend", { precision: 12, scale: 2 }).default("0").notNull(),
  level: mysqlEnum("level", ["ad", "adset", "campaign"]).default("ad").notNull(),
  datePreset: varchar("datePreset", { length: 32 }).default("last_7d").notNull(),
  cron: varchar("cron", { length: 64 }).default("0 0 */3 * * *").notNull(),
  checkHour: int("checkHour").default(9).notNull(),
  checkMinute: int("checkMinute").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AutoPauseRule = typeof autoPauseRules.$inferSelect;

export const autoPauseLogs = mysqlTable("auto_pause_logs", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  userId: int("userId").notNull(),
  runAt: timestamp("runAt").defaultNow().notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  adsChecked: int("adsChecked").default(0).notNull(),
  matchedCount: int("matchedCount").default(0).notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  detail: text("detail"),
});
export type AutoPauseLog = typeof autoPauseLogs.$inferSelect;

/* ============================================================
 * Reports & A/B testing
 * ============================================================ */
export const weeklyReports = mysqlTable("weekly_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  weekStart: varchar("weekStart", { length: 16 }).notNull(),
  weekEnd: varchar("weekEnd", { length: 16 }).notNull(),
  data: json("data"),
  aiSummary: text("aiSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WeeklyReport = typeof weeklyReports.$inferSelect;

export const weeklyReportSettings = mysqlTable("weekly_report_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  cron: varchar("cron", { length: 64 }).default("0 0 1 * * 1").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WeeklyReportSetting = typeof weeklyReportSettings.$inferSelect;

export const abTests = mysqlTable("ab_tests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  variantAType: mysqlEnum("variantAType", ["ad", "campaign", "adset"]).notNull(),
  variantAId: varchar("variantAId", { length: 64 }).notNull(),
  variantAName: varchar("variantAName", { length: 255 }),
  variantBType: mysqlEnum("variantBType", ["ad", "campaign", "adset"]).notNull(),
  variantBId: varchar("variantBId", { length: 64 }).notNull(),
  variantBName: varchar("variantBName", { length: 255 }),
  datePreset: varchar("datePreset", { length: 32 }).default("last_7d").notNull(),
  metricsA: json("metricsA"),
  metricsB: json("metricsB"),
  winner: varchar("winner", { length: 16 }),
  aiAnalysis: text("aiAnalysis"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AbTest = typeof abTests.$inferSelect;

/* ============================================================
 * Dayparting schedules
 * ============================================================ */
export const daypartingSchedules = mysqlTable("dayparting_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  campaignId: varchar("campaignId", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  scheduleJson: json("scheduleJson"),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Bangkok").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DaypartingSchedule = typeof daypartingSchedules.$inferSelect;
