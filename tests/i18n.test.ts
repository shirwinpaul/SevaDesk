import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { ta } from "@/i18n/ta";
import { fmt } from "@/i18n";

function shape(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null || Array.isArray(o)) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n", () => {
  it("Tamil and English have the same keys", () => {
    expect(shape(ta).sort()).toEqual(shape(en).sort());
  });
  it("arrays have the same length in both languages", () => {
    expect(ta.landing.what.length).toBe(en.landing.what.length);
    expect(ta.onboarding.strengthLevels.length).toBe(en.onboarding.strengthLevels.length);
  });
  it("fmt fills placeholders", () => {
    expect(fmt("Step {n} of {total}", { n: 1, total: 5 })).toBe("Step 1 of 5");
    expect(fmt("{missing}", {})).toBe("{missing}");
  });
});
