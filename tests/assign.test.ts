import { describe, expect, it } from "vitest";
import { autoAssign, checkManualAssignment, shiftHours, weekday } from "@/lib/assign";
import { ShiftSchema, VolunteerSchema, type Shift, type Volunteer } from "@/types/models";

// Fictional volunteers. 2026-11-07 is a Saturday (weekday 6).
const DATE = "2026-11-07";
const vol = (id: string, extra: Partial<Volunteer> = {}): Volunteer =>
  VolunteerSchema.parse({
    id,
    name: `Fake ${id}`,
    availableDays: [0, 6],
    availableSlots: ["morning", "afternoon"],
    createdAt: "2026-10-01",
    ...extra,
  });
const shift = (id: string, extra: Partial<Shift> = {}): Shift =>
  ShiftSchema.parse({ id, role: id, slot: "morning", start: "08:00", end: "12:00", required: 1, ...extra });

describe("shift auto-assignment", () => {
  it("computes weekdays from calendar dates", () => {
    expect(weekday(DATE)).toBe(6);
    expect(weekday("2026-11-02")).toBe(1);
  });

  it("respects availability (day and slot)", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("eve", { slot: "evening", start: "17:00", end: "20:00" }), shift("am")],
      volunteers: [vol("a"), vol("weekday", { availableDays: [1, 2] })],
    });
    expect(r.assignments).toEqual([{ shiftId: "am", volunteerId: "a" }]);
    expect(r.unfilled).toEqual([{ shiftId: "eve", role: "eve", missing: 1 }]);
  });

  it("requires every listed skill", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("firstaid", { requiredSkills: ["firstAid"] })],
      volunteers: [vol("a", { skills: ["cooking"] }), vol("b", { skills: ["firstAid", "driving"] })],
    });
    expect(r.assignments).toEqual([{ shiftId: "firstaid", volunteerId: "b" }]);
  });

  it("never double-books overlapping shifts", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("s1", { start: "08:00", end: "11:00" }), shift("s2", { start: "10:00", end: "12:00" })],
      volunteers: [vol("only")],
    });
    expect(r.assignments).toHaveLength(1);
    expect(r.unfilled).toHaveLength(1);
  });

  it("allows back-to-back (non-overlapping) shifts", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("s1", { start: "08:00", end: "10:00" }), shift("s2", { start: "10:00", end: "12:00" })],
      volunteers: [vol("only")],
    });
    expect(r.assignments).toHaveLength(2);
  });

  it("respects busy times from other events", () => {
    const r = autoAssign({ date: DATE, shifts: [shift("s1")], volunteers: [vol("a")], busy: { a: [{ start: "09:00", end: "09:30" }] } });
    expect(r.assignments).toHaveLength(0);
  });

  it("balances load fairly", () => {
    const shifts = [0, 1, 2, 3, 4, 5].map((i) => shift(`s${i}`, { start: `${String(8 + i).padStart(2, "0")}:00`, end: `${String(9 + i).padStart(2, "0")}:00`, slot: i < 4 ? "morning" : "afternoon" }));
    const r = autoAssign({ date: DATE, shifts, volunteers: [vol("a"), vol("b"), vol("c")] });
    expect(r.unfilled).toEqual([]);
    expect(Object.values(r.load)).toEqual([2, 2, 2]);
  });

  it("uses prior load across events", () => {
    const r = autoAssign({ date: DATE, shifts: [shift("s1")], volunteers: [vol("busy"), vol("fresh")], priorLoad: { busy: 5 } });
    expect(r.assignments[0]!.volunteerId).toBe("fresh");
  });

  it("fills scarce roles first so specialists are not used up", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("general", { start: "08:00", end: "12:00" }), shift("driver", { requiredSkills: ["driving"], start: "08:00", end: "12:00" })],
      volunteers: [vol("driver", { skills: ["driving"] }), vol("helper")],
    });
    expect(r.unfilled).toEqual([]);
    expect(r.assignments).toContainEqual({ shiftId: "driver", volunteerId: "driver" });
  });

  it("keeps manual assignments and reports unfilled roles with counts", () => {
    const r = autoAssign({
      date: DATE,
      shifts: [shift("reg", { required: 3 })],
      volunteers: [vol("a"), vol("b")],
      existing: [{ shiftId: "reg", volunteerId: "b" }],
    });
    expect(r.assignments).toContainEqual({ shiftId: "reg", volunteerId: "b" });
    expect(r.assignments).toHaveLength(2);
    expect(r.unfilled).toEqual([{ shiftId: "reg", role: "reg", missing: 1 }]);
  });

  it("skips inactive volunteers", () => {
    const r = autoAssign({ date: DATE, shifts: [shift("s")], volunteers: [vol("x", { active: false })] });
    expect(r.assignments).toEqual([]);
  });

  it("10 fake volunteers fill a blood camp roster without double-booking", () => {
    const vols = Array.from({ length: 10 }, (_, i) => vol(`v${i}`, { skills: i < 3 ? ["firstAid"] : i < 5 ? ["dataEntry"] : [] }));
    const shifts = [
      shift("reg-am", { required: 2, requiredSkills: ["dataEntry"] }),
      shift("aid-am", { required: 2, requiredSkills: ["firstAid"] }),
      shift("refresh-am", { required: 3 }),
      shift("reg-pm", { required: 2, slot: "afternoon", start: "12:00", end: "16:00", requiredSkills: ["dataEntry"] }),
      shift("refresh-pm", { required: 3, slot: "afternoon", start: "12:00", end: "16:00" }),
    ];
    const r = autoAssign({ date: DATE, shifts, volunteers: vols });
    expect(r.unfilled).toEqual([]);
    for (const v of vols) {
      const mine = r.assignments.filter((a) => a.volunteerId === v.id).map((a) => a.shiftId);
      expect(mine.filter((s) => s.endsWith("-am")).length).toBeLessThanOrEqual(1);
      expect(mine.filter((s) => s.endsWith("-pm")).length).toBeLessThanOrEqual(1);
    }
    const counts = Object.values(r.load);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe("manual adjustments and hours", () => {
  it("flags double-booking and ineligible moves", () => {
    const s1 = shift("s1");
    const s2 = shift("s2", { start: "11:00", end: "13:00" });
    const s3 = shift("s3", { requiredSkills: ["driving"], start: "13:00", end: "14:00", slot: "afternoon" });
    const v = vol("a");
    expect(checkManualAssignment(v, s2, DATE, [s1, s2, s3], [{ shiftId: "s1", volunteerId: "a" }])).toBe("doubleBooked");
    expect(checkManualAssignment(v, s3, DATE, [s1, s2, s3], [])).toBe("notEligible");
    expect(checkManualAssignment(v, s1, DATE, [s1], [])).toBeNull();
  });

  it("computes shift hours including overnight", () => {
    expect(shiftHours({ start: "08:00", end: "12:30" })).toBe(4.5);
    expect(shiftHours({ start: "22:00", end: "02:00" })).toBe(4);
  });
});
