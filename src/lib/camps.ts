// Camps & drives: supplies calculator, budget totals and timeline dates (pure code).

import { addDays } from "@/lib/tasks";
import type { BudgetLine, Sponsor, Stage, SupplyItem } from "@/types/models";

export interface SupplyTotal {
  id: string;
  item: string;
  unit: string;
  base: number;
  total: number;
  overridden: boolean;
}

/** expected beneficiaries × per-person quantity, plus buffer %, rounded UP to whole units. */
export function supplyTotals(items: SupplyItem[], expected: number): SupplyTotal[] {
  return items.map((s) => {
    const base = Math.max(0, expected) * s.perPerson;
    // Round the intermediate to avoid float noise (e.g. 100 × 1.1 = 110.00000000000001).
    const buffered = Math.round(base * (1 + s.bufferPct / 100) * 1e6) / 1e6;
    const calculated = Math.ceil(buffered);
    return {
      id: s.id,
      item: s.item,
      unit: s.unit,
      base: Math.round(base * 100) / 100,
      total: s.override ?? calculated,
      overridden: s.override !== null,
    };
  });
}

export interface BudgetSummary {
  planned: number;
  actual: number;
  /** actual − planned (positive = over budget) */
  variance: number;
  sponsorCash: number;
  inKindCount: number;
  /** actual spend not covered by cash sponsorship (never below 0) */
  netCost: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function budgetSummary(lines: BudgetLine[], sponsors: Sponsor[]): BudgetSummary {
  const planned = round2(lines.reduce((s, l) => s + l.planned, 0));
  const actual = round2(lines.reduce((s, l) => s + l.actual, 0));
  const sponsorCash = round2(sponsors.filter((s) => s.type === "cash").reduce((s, x) => s + x.amount, 0));
  return {
    planned,
    actual,
    variance: round2(actual - planned),
    sponsorCash,
    inKindCount: sponsors.filter((s) => s.type === "inKind").length,
    netCost: round2(Math.max(0, actual - sponsorCash)),
  };
}

const STAGE_OFFSET: Record<Stage, number> = { "T-30": -30, "T-14": -14, "T-7": -7, "T-1": -1, day: 0, after: 1 };

/** Calendar date on which a timeline stage falls. */
export function stageDate(campDate: string, stage: Stage): string {
  return addDays(campDate, STAGE_OFFSET[stage]);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}
