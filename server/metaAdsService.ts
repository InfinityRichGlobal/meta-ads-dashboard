/**
 * metaAdsService.ts
 * Direct Meta Marketing (Graph) API integration layer.
 * All functions take an access token + ad account id and return raw insights.
 */

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type DatePreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_90d";

export type TimeRange = { since: string; until: string };

export interface MetaApiErrorInfo {
  isTokenError: boolean;
  isPermissionError: boolean;
  code?: number;
  subcode?: number;
  message: string;
}

/** Parse a Meta Graph API error payload into a structured, human-friendly form. */
export function parseMetaApiError(error: any): MetaApiErrorInfo {
  const err = error?.error ?? error;
  const code = err?.code;
  const subcode = err?.error_subcode;
  let message = err?.message || "ไม่ทราบสาเหตุข้อผิดพลาดจาก Meta API";

  // Token-related codes
  const tokenSubcodes = [467, 463, 460, 458, 459, 464];
  const isTokenError = code === 190 || tokenSubcodes.includes(subcode);
  const isPermissionError = code === 10 || code === 200 || code === 403;

  if (isTokenError) {
    if (subcode === 467) message = "Token ถูกยกเลิก (logged out)";
    else if (subcode === 463) message = "Token หมดอายุแล้ว กรุณาสร้าง Token ใหม่";
    else if (subcode === 460) message = "รหัสผ่านเปลี่ยน ต้องเข้าสู่ระบบใหม่";
    else message = "Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบในหน้า Token Management";
  } else if (isPermissionError) {
    message = "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้ ตรวจสอบ permissions ของ Token (ads_read, ads_management)";
  }

  return { isTokenError, isPermissionError, code, subcode, message };
}

export class MetaApiError extends Error {
  info: MetaApiErrorInfo;
  constructor(info: MetaApiErrorInfo) {
    super(info.message);
    this.name = "MetaApiError";
    this.info = info;
  }
}

function normalizeAccountId(adAccountId: string): string {
  const id = adAccountId.trim();
  return id.startsWith("act_") ? id : `act_${id}`;
}

async function graphFetch(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json?.error) {
    throw new MetaApiError(parseMetaApiError(json));
  }
  return json;
}

/** Auto-paginate up to maxPages of a Graph API edge. */
async function graphFetchAll(
  path: string,
  params: Record<string, string>,
  token: string,
  maxPages = 10,
): Promise<any[]> {
  let results: any[] = [];
  let after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const p: Record<string, string> = { ...params, limit: params.limit ?? "200" };
    if (after) p.after = after;
    const json = await graphFetch(path, p, token);
    if (Array.isArray(json?.data)) results = results.concat(json.data);
    after = json?.paging?.cursors?.after;
    if (!json?.paging?.next || !after) break;
  }
  return results;
}

/* ============================================================
 * Date helpers
 * ============================================================ */
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDateRange(preset: DatePreset): TimeRange {
  const now = new Date();
  const until = new Date(now);
  const since = new Date(now);
  switch (preset) {
    case "today":
      break;
    case "yesterday":
      since.setDate(since.getDate() - 1);
      until.setDate(until.getDate() - 1);
      break;
    case "last_7d":
      since.setDate(since.getDate() - 6);
      break;
    case "last_14d":
      since.setDate(since.getDate() - 13);
      break;
    case "last_30d":
      since.setDate(since.getDate() - 29);
      break;
    case "last_90d":
      since.setDate(since.getDate() - 89);
      break;
  }
  return { since: fmt(since), until: fmt(until) };
}

/** Compute the equally-sized previous period that ends right before `range`. */
export function getPreviousPeriodRange(range: TimeRange): TimeRange {
  const since = new Date(range.since);
  const until = new Date(range.until);
  const days = Math.round((until.getTime() - since.getTime()) / 86400000) + 1;
  const prevUntil = new Date(since);
  prevUntil.setDate(prevUntil.getDate() - 1);
  const prevSince = new Date(prevUntil);
  prevSince.setDate(prevSince.getDate() - (days - 1));
  return { since: fmt(prevSince), until: fmt(prevUntil) };
}

/* ============================================================
 * Action extraction helpers
 * ============================================================ */
export function extractActionValue(actions: any[] | undefined, types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  let sum = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) sum += Number(a.value || 0);
  }
  return sum;
}

export const PURCHASE_ACTION_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "onsite_web_purchase",
];

export const MESSAGE_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];

/* ============================================================
 * Token validation
 * ============================================================ */
export async function validateToken(token: string): Promise<{
  id: string;
  name?: string;
  scopes?: string[];
  expiresAt?: number | null;
}> {
  const me = await graphFetch("me", { fields: "id,name" }, token);
  // Try to introspect token for scopes + expiry
  let scopes: string[] | undefined;
  let expiresAt: number | null | undefined;
  try {
    const debug = await graphFetch("debug_token", { input_token: token }, token);
    const d = debug?.data;
    if (d) {
      scopes = d.scopes;
      expiresAt = d.expires_at ? d.expires_at * 1000 : null;
    }
  } catch {
    // debug_token may need app token; ignore failures
  }
  return { id: me.id, name: me.name, scopes, expiresAt };
}

/* ============================================================
 * Insights
 * ============================================================ */
const BASE_INSIGHT_FIELDS =
  "spend,impressions,clicks,reach,ctr,cpm,cpc,frequency,actions,action_values,purchase_roas";

export interface GetInsightsParams {
  level?: "account" | "campaign" | "adset" | "ad";
  datePreset?: DatePreset;
  timeRange?: TimeRange;
  fields?: string;
  breakdowns?: string;
  actionBreakdowns?: string;
  extraParams?: Record<string, string>;
}

export async function getInsights(
  token: string,
  adAccountId: string,
  params: GetInsightsParams = {},
): Promise<any[]> {
  const acct = normalizeAccountId(adAccountId);
  const range = params.timeRange ?? getDateRange(params.datePreset ?? "last_7d");
  const queryParams: Record<string, string> = {
    fields: params.fields ?? BASE_INSIGHT_FIELDS,
    level: params.level ?? "account",
    time_range: JSON.stringify(range),
    limit: "500",
    ...(params.breakdowns ? { breakdowns: params.breakdowns } : {}),
    ...(params.actionBreakdowns ? { action_breakdowns: params.actionBreakdowns } : {}),
    ...(params.extraParams ?? {}),
  };
  return graphFetchAll(`${acct}/insights`, queryParams, token);
}

/** Account-level summary for a single date range. */
export async function getAccountSummary(
  token: string,
  adAccountId: string,
  range: TimeRange,
): Promise<any> {
  const rows = await getInsights(token, adAccountId, { level: "account", timeRange: range });
  return rows[0] ?? null;
}

/* ============================================================
 * Campaigns / AdSets / Ads structures
 * ============================================================ */
export async function getCampaigns(token: string, adAccountId: string): Promise<any[]> {
  const acct = normalizeAccountId(adAccountId);
  return graphFetchAll(
    `${acct}/campaigns`,
    { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time" },
    token,
  );
}

export async function getCampaignInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "campaign",
    timeRange: range,
    fields: BASE_INSIGHT_FIELDS + ",campaign_id,campaign_name",
  });
}

export async function getAdSets(token: string, adAccountId: string, campaignId?: string): Promise<any[]> {
  const acct = normalizeAccountId(adAccountId);
  const path = campaignId ? `${campaignId}/adsets` : `${acct}/adsets`;
  return graphFetchAll(
    path,
    {
      fields:
        "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,targeting",
    },
    token,
  );
}

export async function getAdSetInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "adset",
    timeRange: range,
    fields: BASE_INSIGHT_FIELDS + ",adset_id,adset_name,campaign_id,campaign_name",
  });
}

export async function getAds(token: string, adAccountId: string, campaignId?: string): Promise<any[]> {
  const acct = normalizeAccountId(adAccountId);
  const path = campaignId ? `${campaignId}/ads` : `${acct}/ads`;
  return graphFetchAll(
    path,
    {
      fields:
        "id,name,status,effective_status,campaign_id,adset_id,creative{id,thumbnail_url,image_url,object_story_spec,video_id}",
    },
    token,
  );
}

export async function getAdInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "ad",
    timeRange: range,
    fields: BASE_INSIGHT_FIELDS + ",ad_id,ad_name,adset_id,campaign_id,campaign_name",
  });
}

/* ============================================================
 * Creative insights (video retention)
 * ============================================================ */
const CREATIVE_FIELDS =
  "ad_id,ad_name,impressions,clicks,spend,ctr,actions,action_values,purchase_roas," +
  "video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions," +
  "video_p100_watched_actions,video_3_sec_watched_actions,video_play_actions";

export async function getCreativeInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "ad",
    timeRange: range,
    fields: CREATIVE_FIELDS,
  });
}

/** Fetch creative thumbnails for a list of ad ids (returns map adId -> thumbnail url). */
export async function getAdThumbnails(token: string, adIds: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  await Promise.all(
    adIds.slice(0, 100).map(async (id) => {
      try {
        const json = await graphFetch(
          id,
          { fields: "creative{thumbnail_url,image_url,object_story_spec}" },
          token,
        );
        const c = json?.creative;
        const thumb =
          c?.thumbnail_url ||
          c?.image_url ||
          c?.object_story_spec?.video_data?.image_url ||
          c?.object_story_spec?.link_data?.picture;
        if (thumb) map[id] = thumb;
      } catch {
        /* ignore individual failures */
      }
    }),
  );
  return map;
}

/* ============================================================
 * Breakdowns: region / age+gender / device / hourly
 * ============================================================ */
export async function getRegionInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "region",
    fields: BASE_INSIGHT_FIELDS,
  });
}

export async function getCountryInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "country",
    fields: BASE_INSIGHT_FIELDS,
  });
}

export async function getAgeGenderInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "age,gender",
    fields: BASE_INSIGHT_FIELDS,
  });
}

export async function getDeviceInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "device_platform",
    fields: BASE_INSIGHT_FIELDS,
  });
}

export async function getHourlyInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: BASE_INSIGHT_FIELDS,
  });
}

/**
 * True 7x24 dayparting: request daily time_increment + hourly breakdown so each row
 * carries a date_start (-> day of week) and an hour bucket. Returns rows annotated
 * with `dow` (0=Sun..6=Sat) and `hour` (0..23).
 */
export async function getDayHourInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  const rows = await getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: BASE_INSIGHT_FIELDS,
    extraParams: { time_increment: "1" },
  });
  return rows.map((r) => {
    const label: string = r.hourly_stats_aggregated_by_advertiser_time_zone ?? "00:00:00 - 00:59:59";
    const hour = parseInt(label.slice(0, 2), 10) || 0;
    const dateStr: string | undefined = r.date_start;
    const dow = dateStr ? new Date(dateStr + "T00:00:00").getDay() : 0;
    return { ...r, hour, dow };
  });
}

/** Ad set level quality insights with purchase + messaging actions. */
export async function getAdSetQualityInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "adset",
    timeRange: range,
    fields: BASE_INSIGHT_FIELDS + ",adset_id,adset_name,campaign_name",
  });
}

export async function getAgeGenderQualityInsights(token: string, adAccountId: string, range: TimeRange): Promise<any[]> {
  return getInsights(token, adAccountId, {
    level: "account",
    timeRange: range,
    breakdowns: "age,gender",
    fields: BASE_INSIGHT_FIELDS,
  });
}

/* ============================================================
 * Mutations: pause / resume an ad (notification-safe wrappers)
 * ============================================================ */
export async function updateAdStatus(
  token: string,
  adId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<boolean> {
  const url = new URL(`${GRAPH_BASE}/${adId}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, access_token: token }),
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    throw new MetaApiError(parseMetaApiError(json));
  }
  return true;
}

/* ============================================================
 * Targeting / Audience search (Meta Targeting Search API)
 * ============================================================ */

/** Search targeting interests via adinterestsearch endpoint. */
export async function searchTargetingInterests(
  token: string,
  query: string,
  locale = "th_TH",
): Promise<any[]> {
  const json = await graphFetch(
    "search",
    { type: "adinterest", q: query, locale, limit: "50" },
    token,
  );
  return Array.isArray(json?.data) ? json.data : [];
}

/** Browse targeting categories (interests or behaviors) for an ad account. */
export async function browseTargetingCategories(
  token: string,
  adAccountId: string,
  type: "interests" | "behaviors" = "interests",
): Promise<any[]> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const classMap: Record<string, string> = {
    interests: "interests",
    behaviors: "behaviors",
  };
  const json = await graphFetch(
    `${acct}/targetingbrowse`,
    { limit: "200" },
    token,
  ).catch(() => null);
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const wanted = classMap[type];
  // targetingbrowse returns mixed types; filter by `type` field when present
  const filtered = rows.filter(
    (r: any) => !r.type || String(r.type).toLowerCase().includes(wanted.slice(0, 6)),
  );
  return filtered.length > 0 ? filtered : rows;
}

/** Estimate reach/audience size for a targeting spec via delivery_estimate. */
export async function estimateAudienceSize(
  token: string,
  adAccountId: string,
  targetingSpec: Record<string, any>,
): Promise<{
  estimateReady: boolean;
  audienceSizeLowerBound: number;
  audienceSizeUpperBound: number;
}> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const json = await graphFetch(
    `${acct}/reachestimate`,
    { targeting_spec: JSON.stringify(targetingSpec) },
    token,
  ).catch(async () => {
    // Fallback to delivery_estimate (requires optimization_goal)
    return graphFetch(
      `${acct}/delivery_estimate`,
      {
        targeting_spec: JSON.stringify(targetingSpec),
        optimization_goal: "REACH",
      },
      token,
    );
  });
  const data = Array.isArray(json?.data) ? json.data[0] : json?.data ?? json;
  const users = data?.users ?? data?.estimate_mau ?? 0;
  const lower = data?.users_lower_bound ?? data?.estimate_dau ?? users;
  const upper = data?.users_upper_bound ?? users;
  return {
    estimateReady: data?.estimate_ready ?? true,
    audienceSizeLowerBound: Number(lower) || 0,
    audienceSizeUpperBound: Number(upper) || 0,
  };
}
