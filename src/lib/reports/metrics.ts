// Impact metrics — computed by code from the user's own records. Every number that
// appears in a report comes from here (Principle 4), never from the AI.

import type { Camp, Case, CaseCategory, Donation, Task, Volunteer } from "@/types/models";

export type PeriodKind = "month" | "quarter" | "year";

export interface Period {
  kind: PeriodKind;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

/** The month / quarter / year containing `ref` (YYYY-MM-DD). */
export function periodFor(kind: PeriodKind, ref: string): Period {
  const [y, m] = ref.split("-").map(Number) as [number, number];
  if (kind === "year") return { kind, from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  if (kind === "quarter") {
    const q = Math.floor((m - 1) / 3);
    const sm = q * 3 + 1;
    const em = sm + 2;
    return { kind, from: `${y}-${pad(sm)}-01`, to: `${y}-${pad(em)}-${pad(lastDay(y, em))}`, label: `Q${q + 1} ${y}` };
  }
  return { kind, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, label: `${y}-${pad(m)}` };
}

const inRange = (d: string | null | undefined, p: Pick<Period, "from" | "to">) => !!d && d.slice(0, 10) >= p.from && d.slice(0, 10) <= p.to;

export interface ImpactData {
  cases: Case[];
  tasks: Task[];
  camps: Camp[];
  volunteers: Volunteer[];
  donations: Donation[];
}

export interface ImpactMetrics {
  casesOpened: number;
  casesClosed: number;
  followUpsDone: number;
  campsHeld: number;
  peopleServedAtCamps: number;
  peopleReached: number;
  reachByCategory: Partial<Record<CaseCategory, number>>;
  volunteerHours: number;
  activeVolunteers: number;
  donationsCash: number;
  donationsInKind: number;
  byArea: Array<{ area: string; cases: number; people: number }>;
}

export function computeImpact(data: ImpactData, p: Pick<Period, "from" | "to">): ImpactMetrics {
  const opened = data.cases.filter((c) => inRange(c.createdAt, p));
  const camps = data.camps.filter((c) => c.afterEvent && inRange(c.date, p));
  const reachByCategory: Partial<Record<CaseCategory, number>> = {};
  const add = (k: CaseCategory, n: number) => (reachByCategory[k] = (reachByCategory[k] ?? 0) + n);
  // A case counts once, under its first category; camps count their people served.
  for (const c of opened) add(c.categories[0] ?? "other", 1);
  for (const c of camps) add(c.afterEvent!.category, c.afterEvent!.peopleServed);

  const areas = new Map<string, { cases: number; people: number }>();
  const area = (name: string) => {
    const key = name.trim() || "—";
    if (!areas.has(key)) areas.set(key, { cases: 0, people: 0 });
    return areas.get(key)!;
  };
  opened.forEach((c) => area(c.area).cases++);
  camps.forEach((c) => (area(c.area || c.location).people += c.afterEvent!.peopleServed));

  let hours = 0;
  const active = new Set<string>();
  for (const v of data.volunteers) {
    for (const h of v.hoursLog) {
      if (inRange(h.date, p)) {
        hours += h.hours;
        active.add(v.id);
      }
    }
  }
  const donations = data.donations.filter((d) => inRange(d.date, p));
  const peopleServedAtCamps = camps.reduce((s, c) => s + c.afterEvent!.peopleServed, 0);

  return {
    casesOpened: opened.length,
    casesClosed: data.cases.filter((c) => inRange(c.closedAt, p)).length,
    followUpsDone: data.tasks.filter((t) => t.status === "done" && inRange(t.doneAt, p)).length,
    campsHeld: camps.length,
    peopleServedAtCamps,
    peopleReached: opened.length + peopleServedAtCamps,
    reachByCategory,
    volunteerHours: Math.round(hours * 100) / 100,
    activeVolunteers: active.size,
    donationsCash: Math.round(donations.filter((d) => d.type === "cash").reduce((s, d) => s + d.amount, 0) * 100) / 100,
    donationsInKind: donations.filter((d) => d.type === "inKind").length,
    byArea: [...areas.entries()].map(([a, v]) => ({ area: a, ...v })).sort((x, y) => y.cases + y.people - (x.cases + x.people)),
  };
}

/** Monthly series (oldest first) for trend charts. */
export function monthlySeries(data: ImpactData, endRef: string, months = 12): Array<{ month: string } & Pick<ImpactMetrics, "casesOpened" | "casesClosed" | "followUpsDone" | "peopleServedAtCamps" | "volunteerHours">> {
  const [y, m] = endRef.split("-").map(Number) as [number, number];
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const p = periodFor("month", d.toISOString().slice(0, 10));
    const mtr = computeImpact(data, p);
    out.push({
      month: p.label,
      casesOpened: mtr.casesOpened,
      casesClosed: mtr.casesClosed,
      followUpsDone: mtr.followUpsDone,
      peopleServedAtCamps: mtr.peopleServedAtCamps,
      volunteerHours: mtr.volunteerHours,
    });
  }
  return out;
}
