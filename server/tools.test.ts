import { describe, expect, it } from "vitest";
import { computeBreakeven } from "./routers/breakeven";
import { zTest } from "./routers/abtest";

describe("computeBreakeven", () => {
  it("computes total cost, gross profit, margin", () => {
    const r = computeBreakeven({ costPrice: 100, sellingPrice: 300, shippingCost: 30, packingCost: 10 });
    expect(r.totalCost).toBe(140);
    expect(r.grossProfit).toBe(160);
    expect(r.profitMargin).toBeCloseTo((160 / 300) * 100, 4);
    // breakeven roas = 300 / 160
    expect(r.breakevenRoas).toBeCloseTo(300 / 160, 2);
    expect(r.maxCpa).toBe(160);
  });
  it("returns null breakevenRoas when no gross profit", () => {
    const r = computeBreakeven({ costPrice: 300, sellingPrice: 200, shippingCost: 0, packingCost: 0 });
    expect(r.grossProfit).toBe(-100);
    expect(r.breakevenRoas).toBeNull();
  });
});

describe("zTest", () => {
  it("returns non-significant when clicks are zero", () => {
    const r = zTest(0, 0, 5, 100);
    expect(r.significant).toBe(false);
    expect(r.pValue).toBe(1);
  });
  it("detects significant difference for large gaps", () => {
    // A: 50/1000 = 5%, B: 150/1000 = 15% -> very significant
    const r = zTest(50, 1000, 150, 1000);
    expect(r.significant).toBe(true);
    expect(r.pValue).toBeLessThan(0.05);
    expect(Math.abs(r.z)).toBeGreaterThan(1.96);
  });
  it("returns non-significant for near-equal rates", () => {
    const r = zTest(50, 1000, 52, 1000);
    expect(r.significant).toBe(false);
  });
});
