import { describe, expect, it } from "vitest";
import { addDays, bucketTasks, dateInZone, tasksToIcs } from "@/lib/tasks";
import { TaskSchema, type Task } from "@/types/models";

const task = (id: string, dueDate: string, extra: Partial<Task> = {}): Task =>
  TaskSchema.parse({ id, title: `Call Kavya Testperson about ${id}`, dueDate, createdAt: "2026-10-01", ...extra });

describe("task views with time zones", () => {
  // 2026-10-30 20:00 UTC = 2026-10-31 01:30 in India.
  const now = new Date("2026-10-30T20:00:00Z");

  it("computes today in the given zone", () => {
    expect(dateInZone(now, "Asia/Kolkata")).toBe("2026-10-31");
    expect(dateInZone(now, "UTC")).toBe("2026-10-30");
    expect(dateInZone(now, "America/Los_Angeles")).toBe("2026-10-30");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-30", 6)).toBe("2027-01-05");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("buckets tasks into overdue / today / week / later (India)", () => {
    const tasks = [
      task("a", "2026-10-30"),
      task("b", "2026-10-31"),
      task("c", "2026-11-06"),
      task("d", "2026-11-07"),
      task("e", "2026-10-01", { status: "done" }),
    ];
    const b = bucketTasks(tasks, now, "Asia/Kolkata");
    expect(b.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(b.today.map((t) => t.id)).toEqual(["b"]);
    expect(b.week.map((t) => t.id)).toEqual(["c"]);
    expect(b.later.map((t) => t.id)).toEqual(["d"]);
  });

  it("the same instant gives a different 'today' in UTC", () => {
    const b = bucketTasks([task("a", "2026-10-30"), task("b", "2026-10-31")], now, "UTC");
    expect(b.today.map((t) => t.id)).toEqual(["a"]);
    expect(b.week.map((t) => t.id)).toEqual(["b"]);
  });

  it("sorts by due date then priority", () => {
    const b = bucketTasks([task("low", "2026-10-31", { priority: "low" }), task("high", "2026-10-31", { priority: "high" })], now);
    expect(b.today.map((t) => t.id)).toEqual(["high", "low"]);
  });
});

describe("ICS export", () => {
  it("uses masked titles only — no names or note text", () => {
    const ics = tasksToIcs([task("t1", "2026-11-02", { caseId: "c1" }), task("t2", "2026-11-03")], { c1: 123 });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Follow-up: Case #0123");
    expect(ics).toContain("SUMMARY:Follow-up: SevaDesk task");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261102");
    expect(ics).not.toMatch(/Kavya|Testperson|Call/);
  });

  it("skips done tasks and returns empty for nothing to export", () => {
    expect(tasksToIcs([task("t", "2026-11-02", { status: "done" })], {})).toBe("");
  });
});
