// Report assembly: code-provided facts, code-only templates, and the number check.

import { REPORT_TEMPLATES, type ReportKind } from "@/data/reports";
import { formatINR } from "@/lib/camps";
import { allowedNumbers, validateGenerated, type ValidationResult } from "@/lib/validate/numbers";
import type { Camp } from "@/types/models";
import type { ImpactMetrics } from "./metrics";

export type Facts = Record<string, number | string>;

/** Facts for period reports (keys match template placeholders). */
export function periodFacts(m: ImpactMetrics): Facts {
  return {
    casesOpened: m.casesOpened,
    casesClosed: m.casesClosed,
    followUpsDone: m.followUpsDone,
    campsHeld: m.campsHeld,
    peopleServedAtCamps: m.peopleServedAtCamps,
    peopleReached: m.peopleReached,
    volunteerHours: m.volunteerHours,
    activeVolunteers: m.activeVolunteers,
    donationsCash: m.donationsCash,
    donationsInKind: m.donationsInKind,
  };
}

/** Facts for one completed camp/event. */
export function eventFacts(c: Camp): Facts {
  const a = c.afterEvent;
  return {
    eventTitle: c.title,
    eventDate: c.date,
    eventLocation: c.location,
    peopleServed: a?.peopleServed ?? 0,
    volunteers: a?.volunteers ?? 0,
    unitsCollected: a?.unitsCollected ?? 0,
    itemsDistributed: a?.itemsDistributed ?? 0,
  };
}

function fill(s: string, vars: Facts): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in vars)) return m;
    const v = vars[k]!;
    return typeof v === "number" && k === "donationsCash" ? formatINR(v) : String(v);
  });
}

export interface ReportDoc {
  title: string;
  sections: Array<{ heading: string; body: string }>;
}

/** Template report — works with AI switched off. */
export function templateReport(kind: ReportKind, lang: "en" | "ta" | "both", vars: Facts): ReportDoc {
  const one = (l: "en" | "ta") => {
    const tpl = REPORT_TEMPLATES[kind][l];
    return { title: fill(tpl.title, vars), sections: tpl.sections.map((s) => ({ heading: fill(s.heading, vars), body: fill(s.body, vars) })).filter((s) => s.body.trim()) };
  };
  if (lang !== "both") return one(lang);
  const en = one("en");
  const ta = one("ta");
  return { title: `${en.title} / ${ta.title}`, sections: [...en.sections, ...ta.sections] };
}

export function reportToText(doc: ReportDoc): string {
  return [doc.title, "", ...doc.sections.flatMap((s) => [s.heading, s.body, ""])].join("\n").trim();
}

/** Every number in generated text must come from code-provided values. */
export function checkNumbers(text: string, facts: Facts, userText: string[] = [], issuedTokens: string[] = []): ValidationResult {
  const allowed = allowedNumbers([...Object.values(facts), ...userText]);
  // Indian-formatted cash totals are allowed as written too (₹1,50,000).
  return validateGenerated(text, allowed, { issuedTokens });
}

export interface BudgetRow {
  item: string;
  planned: number;
  actual: number;
}

/** Grant outline budget table — filled by code from camp budgets in the period. */
export function budgetTable(camps: Camp[]): BudgetRow[] {
  const rows = new Map<string, BudgetRow>();
  for (const c of camps) {
    for (const b of c.budget) {
      const r = rows.get(b.item) ?? { item: b.item, planned: 0, actual: 0 };
      r.planned += b.planned;
      r.actual += b.actual;
      rows.set(b.item, r);
    }
  }
  return [...rows.values()];
}
