import { describe, expect, it } from "vitest";
import { budgetTable, checkNumbers, eventFacts, periodFacts, reportToText, templateReport } from "@/lib/reports/generate";
import { computeImpact, periodFor } from "@/lib/reports/metrics";
import { mask, restore } from "@/lib/mask";
import { CampSchema } from "@/types/models";

const camp = CampSchema.parse({
  id: "k1",
  templateId: "blood",
  title: "Fake Blood Camp",
  date: "2026-11-07",
  location: "Test Hall",
  createdAt: "x",
  budget: [
    { id: "b1", item: "Tent", planned: 5000, actual: 4500 },
    { id: "b2", item: "Food", planned: 3000, actual: 3200 },
  ],
  afterEvent: { peopleServed: 120, volunteers: 10, unitsCollected: 85, itemsDistributed: 0, highlights: "", category: "health", completedAt: "x" },
});

describe("report templates (no AI)", () => {
  it("fills numbers from code in English and Tamil", () => {
    const facts = { ...eventFacts(camp), org: "Fake Trust", highlights: "Smooth day." };
    const en = templateReport("event", "en", facts);
    expect(reportToText(en)).toContain("People served: 120");
    const ta = templateReport("event", "ta", facts);
    expect(reportToText(ta)).toContain("பயன்பெற்றோர்: 120");
    const both = templateReport("event", "both", facts);
    expect(both.sections.length).toBe(en.sections.length + ta.sections.length);
  });

  it("formats cash in Indian grouping and all template numbers pass the validator", () => {
    const m = computeImpact({ cases: [], tasks: [], camps: [camp], volunteers: [], donations: [] }, periodFor("month", "2026-11-01"));
    const facts = { ...periodFacts(m), donationsCash: 150000, org: "Fake Trust", period: "2026-11", highlights: "" };
    const text = reportToText(templateReport("monthly", "en", facts));
    expect(text).toContain("₹1,50,000");
    expect(checkNumbers(text, facts).ok).toBe(true);
  });
});

describe("report validator", () => {
  const facts = eventFacts(camp);

  it("flags a number the code did not provide", () => {
    const r = checkNumbers("We served 120 people; over 500 residents praised it.", facts);
    expect(r.ok).toBe(false);
    expect(r.unverifiedNumbers).toEqual(["500"]);
  });

  it("accepts dates and user-written numbers", () => {
    expect(checkNumbers("On 7 November 2026, 85 units were collected. Started at 9.", facts, ["Opened at 9"]).ok).toBe(true);
  });

  it("tokens are all restored and unknown tokens are flagged", () => {
    const { masked, map } = mask("Thanks to Dr Fakedoc at Test Hall", { knownNames: ["Fakedoc"], knownPlaces: ["Test Hall"] });
    const aiOut = `${masked} and {{PERSON_9}}.`;
    const r = checkNumbers(aiOut, {}, [], Object.keys(map));
    expect(r.unknownTokens).toEqual(["{{PERSON_9}}"]);
    const restored = restore(masked, map);
    expect(restored.unknownTokens).toEqual([]);
    expect(restored.text).toBe("Thanks to Dr Fakedoc at Test Hall");
  });
});

describe("grant budget table", () => {
  it("sums budget lines by item across camps", () => {
    expect(budgetTable([camp, camp])).toEqual([
      { item: "Tent", planned: 10000, actual: 9000 },
      { item: "Food", planned: 6000, actual: 6400 },
    ]);
  });
});
