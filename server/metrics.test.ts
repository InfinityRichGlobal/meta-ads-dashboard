import { describe, expect, it } from "vitest";
import {
  aggregateMetrics,
  classifySignal,
  deriveMetrics,
  pctChange,
  sumActionValue,
} from "../shared/metrics";

describe("sumActionValue", () => {
  it("sums values matching action types", () => {
    const actions = [
      { action_type: "purchase", value: "3" },
      { action_type: "link_click", value: "10" },
      { action_type: "purchase", value: 2 },
    ];
    expect(sumActionValue(actions, ["purchase"])).toBe(5);
  });
  it("returns 0 for undefined", () => {
    expect(sumActionValue(undefined, ["purchase"])).toBe(0);
  });
});

describe("deriveMetrics", () => {
  it("returns zeros for null row", () => {
    const m = deriveMetrics(null);
    expect(m.spend).toBe(0);
    expect(m.roas).toBe(0);
  });
  it("derives ctr/cpc/cpa from raw values", () => {
    const m = deriveMetrics({
      spend: "100",
      impressions: "10000",
      clicks: "200",
      actions: [{ action_type: "purchase", value: "10" }],
      action_values: [{ action_type: "purchase", value: "500" }],
    });
    expect(m.spend).toBe(100);
    expect(m.clicks).toBe(200);
    expect(m.conversions).toBe(10);
    expect(m.ctr).toBeCloseTo(2, 5); // 200/10000*100
    expect(m.cpc).toBeCloseTo(0.5, 5); // 100/200
    expect(m.cpa).toBeCloseTo(10, 5); // 100/10
    expect(m.roas).toBeCloseTo(5, 5); // 500/100
  });
  it("prefers purchase_roas array when present", () => {
    const m = deriveMetrics({
      spend: "100",
      purchase_roas: [{ action_type: "omni_purchase", value: "3.2" }],
    });
    expect(m.roas).toBeCloseTo(3.2, 5);
  });
});

describe("aggregateMetrics", () => {
  it("aggregates multiple rows correctly", () => {
    const rows = [
      { spend: "50", impressions: "5000", clicks: "100", action_values: [{ action_type: "purchase", value: "200" }], actions: [{ action_type: "purchase", value: "4" }] },
      { spend: "50", impressions: "5000", clicks: "100", action_values: [{ action_type: "purchase", value: "300" }], actions: [{ action_type: "purchase", value: "6" }] },
    ];
    const m = aggregateMetrics(rows);
    expect(m.spend).toBe(100);
    expect(m.impressions).toBe(10000);
    expect(m.conversions).toBe(10);
    expect(m.conversionValue).toBe(500);
    expect(m.roas).toBeCloseTo(5, 5);
    expect(m.cpa).toBeCloseTo(10, 5);
  });
  it("handles empty input", () => {
    const m = aggregateMetrics([]);
    expect(m.spend).toBe(0);
    expect(m.ctr).toBe(0);
  });
});

describe("pctChange", () => {
  it("computes positive change", () => {
    expect(pctChange(150, 100)).toBeCloseTo(50, 5);
  });
  it("computes negative change", () => {
    expect(pctChange(80, 100)).toBeCloseTo(-20, 5);
  });
  it("returns null when previous is 0 and current non-zero", () => {
    expect(pctChange(100, 0)).toBeNull();
  });
  it("returns 0 when both are 0", () => {
    expect(pctChange(0, 0)).toBe(0);
  });
});

describe("classifySignal", () => {
  it("green for strong ROAS", () => {
    const m = deriveMetrics({ spend: "100", action_values: [{ action_type: "purchase", value: "300" }] });
    expect(classifySignal(m, { minRoas: 1 })).toBe("green"); // roas 3 >= 1.5
  });
  it("red for poor ROAS", () => {
    const m = deriveMetrics({ spend: "100", action_values: [{ action_type: "purchase", value: "50" }] });
    expect(classifySignal(m, { minRoas: 1 })).toBe("red"); // roas 0.5 < 1
  });
  it("uses CPA benchmark when no conversion value", () => {
    const m = deriveMetrics({ spend: "100", actions: [{ action_type: "purchase", value: "10" }] });
    // cpa = 10, target 12 -> green
    expect(classifySignal(m, { targetCpa: 12 })).toBe("green");
    // target 8 -> cpa 10 > 8*1.3=10.4? no, 10<=10.4 -> yellow
    expect(classifySignal(m, { targetCpa: 8 })).toBe("yellow");
  });
});
