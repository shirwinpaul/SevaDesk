import { describe, expect, it } from "vitest";
import { computeImpact, monthlySeries, periodFor } from "@/lib/reports/metrics";
import { CampSchema, CaseSchema, DonationSchema, TaskSchema, VolunteerSchema } from "@/types/models";

// All fictional.
const kase = (id: string, created: string, extra = {}) =>
  CaseSchema.parse({ id, number: 1, displayName: `Fake ${id}`, consent: "verbal", createdAt: created, updatedAt: created, ...extra });

const data = {
  cases: [
    kase("a", "2026-10-02T10:00:00Z", { categories: ["health"], area: "Fakepuram" }),
    kase("b", "2026-10-20T10:00:00Z", { categories: ["education", "health"], area: "Fakepuram", status: "closed", closedAt: "2026-10-25T10:00:00Z" }),
    kase("c", "2026-09-10T10:00:00Z", { area: "Testnagar" }),
  ],
  tasks: [
    TaskSchema.parse({ id: "t1", title: "x", dueDate: "2026-10-05", status: "done", doneAt: "2026-10-05T09:00:00Z", createdAt: "2026-10-01" }),
    TaskSchema.parse({ id: "t2", title: "y", dueDate: "2026-10-05", createdAt: "2026-10-01" }),
  ],
  camps: [
    CampSchema.parse({
      id: "k1",
      templateId: "blood",
      title: "Fake Blood Camp",
      date: "2026-10-12",
      area: "Testnagar",
      createdAt: "2026-09-01",
      afterEvent: { peopleServed: 120, volunteers: 10, unitsCollected: 85, itemsDistributed: 0, highlights: "", category: "health", completedAt: "2026-10-12" },
    }),
    CampSchema.parse({ id: "k2", templateId: "custom", title: "Planned", date: "2026-10-30", createdAt: "2026-09-01" }),
  ],
  volunteers: [
    VolunteerSchema.parse({
      id: "v1",
      name: "Fake Vol",
      createdAt: "2026-01-01",
      hoursLog: [
        { id: "h1", date: "2026-10-12", hours: 4.5 },
        { id: "h2", date: "2026-08-01", hours: 3 },
      ],
    }),
  ],
  donations: [
    DonationSchema.parse({ id: "d1", date: "2026-10-03", type: "cash", amount: 5000, createdAt: "x" }),
    DonationSchema.parse({ id: "d2", date: "2026-10-04", type: "inKind", items: "50 kits", createdAt: "x" }),
  ],
};

describe("periods", () => {
  it("month / quarter / year ranges", () => {
    expect(periodFor("month", "2026-02-14")).toMatchObject({ from: "2026-02-01", to: "2026-02-28", label: "2026-02" });
    expect(periodFor("quarter", "2026-11-05")).toMatchObject({ from: "2026-10-01", to: "2026-12-31", label: "Q4 2026" });
    expect(periodFor("year", "2026-11-05")).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodFor("month", "2028-02-01").to).toBe("2028-02-29");
  });
});

describe("impact metrics", () => {
  const m = computeImpact(data, periodFor("month", "2026-10-15"));

  it("counts cases opened/closed and follow-ups done in the period", () => {
    expect(m.casesOpened).toBe(2);
    expect(m.casesClosed).toBe(1);
    expect(m.followUpsDone).toBe(1);
  });

  it("counts only completed camps in the period", () => {
    expect(m.campsHeld).toBe(1);
    expect(m.peopleServedAtCamps).toBe(120);
    expect(m.peopleReached).toBe(122);
  });

  it("reach by category (case first category + camp people)", () => {
    expect(m.reachByCategory).toEqual({ health: 121, education: 1 });
  });

  it("volunteer hours and donations in range only", () => {
    expect(m.volunteerHours).toBe(4.5);
    expect(m.activeVolunteers).toBe(1);
    expect(m.donationsCash).toBe(5000);
    expect(m.donationsInKind).toBe(1);
  });

  it("area breakdown", () => {
    expect(m.byArea).toEqual([
      { area: "Testnagar", cases: 0, people: 120 },
      { area: "Fakepuram", cases: 2, people: 0 },
    ]);
  });

  it("monthly series", () => {
    const s = monthlySeries(data, "2026-10-15", 3);
    expect(s.map((x) => x.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(s.map((x) => x.casesOpened)).toEqual([0, 1, 2]);
    expect(s[0]!.volunteerHours).toBe(3);
  });
});
