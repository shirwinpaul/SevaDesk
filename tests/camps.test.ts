import { describe, expect, it } from "vitest";
import { budgetSummary, formatINR, stageDate, supplyTotals } from "@/lib/camps";
import { BudgetLineSchema, SponsorSchema, SupplyItemSchema } from "@/types/models";
import { CAMP_TEMPLATES } from "@/data/camps";

const supply = (item: string, perPerson: number, bufferPct = 10, override: number | null = null) =>
  SupplyItemSchema.parse({ id: item, item, perPerson, bufferPct, override });

describe("supplies calculator", () => {
  it("multiplies expected beneficiaries by per-person quantity plus buffer, rounding up", () => {
    const [cups, kits, juice] = supplyTotals([supply("cups", 1, 10), supply("kits", 0.5, 20), supply("juice", 0.2, 15)], 100);
    expect(cups).toMatchObject({ base: 100, total: 110 });
    expect(kits).toMatchObject({ base: 50, total: 60 });
    expect(juice).toMatchObject({ base: 20, total: 23 });
  });

  it("rounds partial units up", () => {
    expect(supplyTotals([supply("x", 0.3, 0)], 7)[0]!.total).toBe(3); // 2.1 → 3
  });

  it("uses an override when set", () => {
    expect(supplyTotals([supply("tents", 1, 10, 4)], 100)[0]).toMatchObject({ total: 4, overridden: true });
  });

  it("handles zero beneficiaries", () => {
    expect(supplyTotals([supply("x", 2)], 0)[0]!.total).toBe(0);
  });
});

describe("budget totals", () => {
  it("sums planned vs actual, sponsors and net cost", () => {
    const lines = [
      BudgetLineSchema.parse({ id: "a", item: "Tent", planned: 5000, actual: 5500 }),
      BudgetLineSchema.parse({ id: "b", item: "Food", planned: 3000.5, actual: 2500.25 }),
    ];
    const sponsors = [
      SponsorSchema.parse({ id: "s1", name: "Fake Traders", type: "cash", amount: 4000 }),
      SponsorSchema.parse({ id: "s2", name: "Test Bakery", type: "inKind", description: "200 buns" }),
    ];
    expect(budgetSummary(lines, sponsors)).toEqual({ planned: 8000.5, actual: 8000.25, variance: -0.25, sponsorCash: 4000, inKindCount: 1, netCost: 4000.25 });
  });

  it("net cost never goes below zero", () => {
    expect(budgetSummary([], [SponsorSchema.parse({ id: "s", name: "X", type: "cash", amount: 100 })]).netCost).toBe(0);
  });

  it("formats rupees in Indian grouping", () => {
    expect(formatINR(150000)).toBe("1,50,000");
  });
});

describe("timeline and templates", () => {
  it("computes stage dates", () => {
    expect(stageDate("2026-11-07", "T-30")).toBe("2026-10-08");
    expect(stageDate("2026-11-07", "T-1")).toBe("2026-11-06");
    expect(stageDate("2026-11-07", "day")).toBe("2026-11-07");
    expect(stageDate("2026-11-07", "after")).toBe("2026-11-08");
  });

  it("ships all 10 templates with checklists, and permission items say 'check local requirements'", () => {
    expect(CAMP_TEMPLATES).toHaveLength(10);
    for (const tpl of CAMP_TEMPLATES) {
      expect(tpl.name.en && tpl.name.ta).toBeTruthy();
      if (tpl.id !== "custom") expect(tpl.checklist.length).toBeGreaterThan(3);
      for (const c of tpl.checklist.filter((x) => x.permission)) {
        expect(c.en.toLowerCase()).toContain("check local requirements");
      }
    }
  });
});
