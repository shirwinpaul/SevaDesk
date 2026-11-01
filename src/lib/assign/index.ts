// Shift auto-assignment (pure code, no AI).
// Rules:
//  1. Eligible = active, available on the event's weekday AND in the shift's time slot,
//     and has every required skill.
//  2. Never double-book: a volunteer cannot hold two shifts whose times overlap
//     (within this event, or against `busy` times from other events that day).
//  3. Fair load: always pick the eligible volunteer with the lowest load so far
//     (prior load + shifts given in this run). Ties → fewer skills first (keeps
//     versatile people free for scarce roles) → name.
//  4. Scarce shifts (fewest eligible volunteers) are filled first.
//  5. Existing (manual) assignments are kept as-is; the algorithm only fills gaps.
//  6. Anything that cannot be filled is reported in `unfilled`.

import type { Assignment, Shift, Volunteer } from "@/types/models";

export interface AssignInput {
  date: string; // YYYY-MM-DD
  shifts: Shift[];
  volunteers: Volunteer[];
  existing?: Assignment[];
  /** Prior load per volunteer (e.g. shifts/hours already done) for fairness across events. */
  priorLoad?: Record<string, number>;
  /** Busy intervals per volunteer from other events on the same date. */
  busy?: Record<string, Array<{ start: string; end: string }>>;
}

export interface AssignResult {
  assignments: Assignment[];
  unfilled: Array<{ shiftId: string; role: string; missing: number }>;
  load: Record<string, number>;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

/** Weekday (0 = Sunday) of a calendar date, independent of the device time zone. */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isEligible(v: Volunteer, s: Shift, date: string): boolean {
  return (
    v.active &&
    v.availableDays.includes(weekday(date)) &&
    v.availableSlots.includes(s.slot) &&
    s.requiredSkills.every((k) => v.skills.includes(k))
  );
}

export function autoAssign(input: AssignInput): AssignResult {
  const { date, shifts, volunteers } = input;
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const assignments: Assignment[] = (input.existing ?? []).filter((a) => byId.has(a.shiftId));
  const load: Record<string, number> = { ...(input.priorLoad ?? {}) };
  for (const v of volunteers) load[v.id] ??= 0;
  for (const a of assignments) load[a.volunteerId] = (load[a.volunteerId] ?? 0) + 1;

  const intervalsOf = (vid: string) => [
    ...(input.busy?.[vid] ?? []),
    ...assignments.filter((a) => a.volunteerId === vid).map((a) => byId.get(a.shiftId)!),
  ];
  const free = (vid: string, s: Shift) => intervalsOf(vid).every((iv) => !overlaps(iv, s));

  const eligibleCount = (s: Shift) => volunteers.filter((v) => isEligible(v, s, date)).length;
  const order = [...shifts].sort((a, b) => eligibleCount(a) - eligibleCount(b) || a.start.localeCompare(b.start));

  const unfilled: AssignResult["unfilled"] = [];
  for (const s of order) {
    let have = assignments.filter((a) => a.shiftId === s.id).length;
    while (have < s.required) {
      const candidates = volunteers
        .filter((v) => isEligible(v, s, date) && !assignments.some((a) => a.shiftId === s.id && a.volunteerId === v.id) && free(v.id, s))
        .sort((a, b) => (load[a.id] ?? 0) - (load[b.id] ?? 0) || a.skills.length - b.skills.length || a.name.localeCompare(b.name));
      const pick = candidates[0];
      if (!pick) break;
      assignments.push({ shiftId: s.id, volunteerId: pick.id });
      load[pick.id] = (load[pick.id] ?? 0) + 1;
      have++;
    }
    if (have < s.required) unfilled.push({ shiftId: s.id, role: s.role, missing: s.required - have });
  }
  return { assignments, unfilled, load };
}

/** Check a manual move: returns a reason string if it would break a rule, else null. */
export function checkManualAssignment(
  v: Volunteer,
  target: Shift,
  date: string,
  shifts: Shift[],
  assignments: Assignment[],
): "doubleBooked" | "notEligible" | null {
  const mine = assignments.filter((a) => a.volunteerId === v.id && a.shiftId !== target.id).map((a) => shifts.find((s) => s.id === a.shiftId));
  if (mine.some((s) => s && overlaps(s, target))) return "doubleBooked";
  if (!isEligible(v, target, date)) return "notEligible";
  return null;
}

/** Hours for a shift (handles shifts ending after midnight). */
export function shiftHours(s: Pick<Shift, "start" | "end">): number {
  let mins = toMinutes(s.end) - toMinutes(s.start);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}
