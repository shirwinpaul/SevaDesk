// Task views (Today / This week / Overdue) and calendar export.
// "Today" is computed in a given IANA time zone (default Asia/Kolkata) so a task due
// "2026-10-30" is due today for a worker in India regardless of the device clock's zone.

import { createEvents, type EventAttributes } from "ics";
import { caseLabel, type Task } from "@/types/models";

export const DEFAULT_TZ = "Asia/Kolkata";

/** YYYY-MM-DD for `date` as seen in `timeZone`. */
export function dateInZone(date: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic, no time-zone drift). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export interface TaskBuckets {
  overdue: Task[];
  today: Task[];
  week: Task[];
  later: Task[];
}

const byDueThenPriority = (a: Task, b: Task) => {
  const rank = { high: 0, normal: 1, low: 2 } as const;
  return a.dueDate.localeCompare(b.dueDate) || rank[a.priority] - rank[b.priority];
};

/** Open tasks split into Overdue (< today), Today, This week (next 1–6 days), Later. */
export function bucketTasks(tasks: Task[], now: Date = new Date(), timeZone: string = DEFAULT_TZ): TaskBuckets {
  const today = dateInZone(now, timeZone);
  const weekEnd = addDays(today, 6);
  const out: TaskBuckets = { overdue: [], today: [], week: [], later: [] };
  for (const t of tasks) {
    if (t.status !== "open") continue;
    if (t.dueDate < today) out.overdue.push(t);
    else if (t.dueDate === today) out.today.push(t);
    else if (t.dueDate <= weekEnd) out.week.push(t);
    else out.later.push(t);
  }
  (Object.keys(out) as Array<keyof TaskBuckets>).forEach((k) => out[k].sort(byDueThenPriority));
  return out;
}

/**
 * Calendar titles are ALWAYS masked: "Follow-up: Case #0123". Calendars sync to
 * third-party servers, so no names, phones or note text are ever included.
 */
export function maskedTaskTitle(task: Task, caseNumber?: number): string {
  return caseNumber ? `Follow-up: Case ${caseLabel(caseNumber)}` : "Follow-up: SevaDesk task";
}

export function tasksToIcs(tasks: Task[], caseNumbers: Record<string, number>): string {
  const events: EventAttributes[] = tasks
    .filter((t) => t.status === "open")
    .map((t) => {
      const [y, m, d] = t.dueDate.split("-").map(Number) as [number, number, number];
      const end = addDays(t.dueDate, 1).split("-").map(Number) as [number, number, number];
      return {
        uid: `${t.id}@sevadesk`,
        title: maskedTaskTitle(t, caseNumbers[t.caseId]),
        start: [y, m, d],
        end,
        description: "Open SevaDesk for details.",
        productId: "sevadesk",
        classification: "PRIVATE",
      };
    });
  if (events.length === 0) return "";
  const { error, value } = createEvents(events);
  if (error || !value) throw new Error("ICS_FAILED");
  return value;
}
