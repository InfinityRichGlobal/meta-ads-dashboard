/**
 * shared/metrics.ts
 * Pure metric-derivation helpers used by both server (aggregation) and client (display).
 */

export interface RawInsightRow {
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  reach?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  cpc?: string | number;
  frequency?: string | number;
  actions?: Array<{ action_type: string; value: string | number }>;
  action_values?: Array<{ action_type: string; value: string | number }>;
  purchase_roas?: Array<{ action_type: string; value: string | number }>;
}

export interface DerivedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number; // %
  cpc: number;
  cpm: number;
  frequency: number;
  conversions: number;
  conversionValue: number;
  cpa: number;
  roas: number;
}

const PURCHASE_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "onsite_web_purchase",
];

const num = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

export function sumActionValue(
  actions: Array<{ action_type: string; value: string | number }> | undefined,
  types: string[],
): number {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce((acc, a) => (types.includes(a.action_type) ? acc + num(a.value) : acc), 0);
}

/** Derive all key metrics from a single raw insight row. */
export function deriveMetrics(row: RawInsightRow | null | undefined): DerivedMetrics {
  if (!row) {
    return {
      spend: 0, impressions: 0, clicks: 0, reach: 0, ctr: 0, cpc: 0, cpm: 0,
      frequency: 0, conversions: 0, conversionValue: 0, cpa: 0, roas: 0,
    };
  }
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const reach = num(row.reach);
  const conversions = sumActionValue(row.actions, PURCHASE_TYPES);
  const conversionValue = sumActionValue(row.action_values, PURCHASE_TYPES);
  const ctr = row.ctr !== undefined ? num(row.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = row.cpc !== undefined ? num(row.cpc) : clicks > 0 ? spend / clicks : 0;
  const cpm = row.cpm !== undefined ? num(row.cpm) : impressions > 0 ? (spend / impressions) * 1000 : 0;
  const frequency = row.frequency !== undefined ? num(row.frequency) : reach > 0 ? impressions / reach : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  let roas = 0;
  if (Array.isArray(row.purchase_roas) && row.purchase_roas.length > 0) {
    roas = num(row.purchase_roas[0].value);
  } else if (spend > 0) {
    roas = conversionValue / spend;
  }
  return { spend, impressions, clicks, reach, ctr, cpc, cpm, frequency, conversions, conversionValue, cpa, roas };
}

/** Aggregate many raw rows into a single derived metric set. */
export function aggregateMetrics(rows: RawInsightRow[]): DerivedMetrics {
  const acc = rows.reduce<{
    spend: number; impressions: number; clicks: number; reach: number; conversions: number; conversionValue: number;
  }>(
    (a, r) => {
      a.spend += num(r.spend);
      a.impressions += num(r.impressions);
      a.clicks += num(r.clicks);
      a.reach += num(r.reach);
      a.conversions += sumActionValue(r.actions, PURCHASE_TYPES);
      a.conversionValue += sumActionValue(r.action_values, PURCHASE_TYPES);
      return a;
    },
    { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0 },
  );
  const ctr = acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0;
  const cpc = acc.clicks > 0 ? acc.spend / acc.clicks : 0;
  const cpm = acc.impressions > 0 ? (acc.spend / acc.impressions) * 1000 : 0;
  const frequency = acc.reach > 0 ? acc.impressions / acc.reach : 0;
  const cpa = acc.conversions > 0 ? acc.spend / acc.conversions : 0;
  const roas = acc.spend > 0 ? acc.conversionValue / acc.spend : 0;
  return { ...acc, ctr, cpc, cpm, frequency, cpa, roas };
}

/** Percentage change between two values (returns null when previous is 0). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Signal light classification for an ad/campaign row. */
export type Signal = "green" | "yellow" | "red";

export interface SignalThresholds {
  targetCpa?: number; // if provided, used as benchmark
  minRoas?: number;
}

export function classifySignal(m: DerivedMetrics, t: SignalThresholds = {}): Signal {
  const targetCpa = t.targetCpa ?? 0;
  const minRoas = t.minRoas ?? 1;

  // ROAS-based primary signal when conversion value exists
  if (m.conversionValue > 0 || m.roas > 0) {
    if (m.roas >= minRoas * 1.5) return "green";
    if (m.roas >= minRoas) return "yellow";
    return "red";
  }
  // CPA-based signal
  if (targetCpa > 0 && m.cpa > 0) {
    if (m.cpa <= targetCpa) return "green";
    if (m.cpa <= targetCpa * 1.3) return "yellow";
    return "red";
  }
  // CTR fallback
  if (m.ctr >= 1.5) return "green";
  if (m.ctr >= 0.8) return "yellow";
  return "red";
}
