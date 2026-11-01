import { describe, expect, it } from "vitest";
import { mask, restore, restoreDeep } from "@/lib/mask";
import { findUnmaskedPii, payloadIsSafe } from "@/lib/mask/guard";
import { allowedNumbers, canonicalNumber, extractNumbers, validateGenerated } from "@/lib/validate/numbers";

// ALL data below is fictional.
const values = (map: Record<string, string>) => Object.values(map);

describe("mask: phones", () => {
  it.each([
    "98765 43210",
    "9876543210",
    "+91 98765 43210",
    "+919876543210",
    "091-98765-43210".slice(1), // 91-98765-43210
    "098765 43210",
    "987-654-3210",
    "044-2345 6789",
    "0422 2345678",
  ])("masks %s", (phone) => {
    const { masked, map } = mask(`Call her on ${phone} tomorrow.`);
    expect(masked).not.toMatch(/\d{3}/);
    expect(masked).toContain("{{PHONE_1}}");
    expect(values(map)).toContain(phone);
  });

  it("same number gets the same token", () => {
    const { masked } = mask("Ph 9876543210. Again: 9876543210");
    expect(masked.match(/\{\{PHONE_1\}\}/g)).toHaveLength(2);
    expect(masked).not.toContain("PHONE_2");
  });
});

describe("mask: IDs", () => {
  it("masks 12-digit Aadhaar-like numbers in all formats (not as phones)", () => {
    for (const id of ["1234 5678 9012", "1234-5678-9012", "123456789012"]) {
      const { masked, map } = mask(`ID ${id} collected`);
      expect(masked).toBe("ID {{ID_1}} collected");
      expect(map["{{ID_1}}"]).toBe(id);
    }
  });

  it("masks PAN / voter-ID-like codes and long account numbers", () => {
    const { masked } = mask("PAN ABCDE1234F, voter ABC1234567, account 123456789012345");
    expect(masked).not.toMatch(/ABCDE1234F|ABC1234567|123456789012345/);
  });
});

describe("mask: emails, PIN codes, DOB, addresses", () => {
  it("masks emails", () => {
    const { masked } = mask("Write to fake.person@example.org please");
    expect(masked).toBe("Write to {{EMAIL_1}} please");
  });

  it("masks PIN codes in address context but not ordinary counts", () => {
    expect(mask("Pincode: 600042").masked).toContain("{{PIN_1}}");
    expect(mask("PIN 600 042").masked).toContain("{{PIN_1}}");
    expect(mask("Fakepuram - 641001").masked).toContain("{{PIN_1}}");
    expect(mask("We served 120 people").masked).toContain("120");
  });

  it("masks dates of birth but keeps other dates", () => {
    for (const s of ["DOB: 12/03/1990", "date of birth 1990-03-12", "born on 12 March 1990", "D.O.B 12-03-1990"]) {
      const { masked, map } = mask(s);
      expect(masked).toContain("{{DOB_1}}");
      expect(values(map).join()).toMatch(/1990/);
    }
    expect(mask("Camp on 12/03/2026").masked).toContain("12/03/2026");
  });

  it("masks addresses", () => {
    for (const s of ["Door No. 12/4, Fake Street", "lives at 45 Gandhi Road near temple", "House no 7B", "12, Anna Nagar"]) {
      const { masked } = mask(s);
      expect(masked).toContain("{{ADDRESS_1}}");
      expect(masked.replace(/\{\{[A-Z]+_\d+\}\}/g, "")).not.toMatch(/\d/);
    }
  });
});

describe("mask: names", () => {
  it("masks names known from case records, including first-name-only mentions", () => {
    const { masked, map } = mask("Visited Kavya Testperson. Kavya needs a ration card.", { knownNames: ["Kavya Testperson"] });
    expect(masked).not.toMatch(/Kavya|Testperson/);
    expect(values(map)).toContain("Kavya Testperson");
  });

  it("known-name matching is case-insensitive and whole-word", () => {
    const { masked } = mask("RAVI came. Ravindra did not.", { knownNames: ["Ravi"], heuristics: false });
    expect(masked).toBe("{{PERSON_1}} came. Ravindra did not.");
  });

  it("masks Tamil-script names from records", () => {
    const { masked } = mask("இன்று கவிதா வீட்டிற்குச் சென்றேன்", { knownNames: ["கவிதா"] });
    expect(masked).not.toContain("கவிதா");
    expect(masked).toContain("{{PERSON_1}}");
  });

  it("masks honorific + name", () => {
    const { masked } = mask("Met Smt Fakeamma and Mr. Testraj today.");
    expect(masked).toBe("Met Smt {{PERSON_1}} and Mr {{PERSON_2}} today.");
  });

  it("capitalised-word heuristic catches mid-sentence names and sentence-start names with name verbs", () => {
    const { masked } = mask("Muthu said the roof leaks. I met Selvaraj Fakename at the shop.");
    expect(masked).not.toMatch(/Muthu|Selvaraj|Fakename/);
  });

  it("does not mask common words, months or days", () => {
    const { masked } = mask("Today the Mother said the Hospital visit is on Monday in March.");
    expect(masked).toBe("Today the Mother said the Hospital visit is on Monday in March.");
  });

  it("masks places after place prepositions and known places", () => {
    const { masked } = mask("Family moved from Fakevillage to the town. Area: Testnagar", { knownPlaces: ["Testnagar"] });
    expect(masked).toContain("{{PLACE_1}}");
    expect(masked).toContain("{{PLACE_2}}");
    expect(masked).not.toMatch(/Fakevillage|Testnagar/);
  });

  it("extra user terms are masked", () => {
    const { masked } = mask("Works at the Sunrise Mill", { extraTerms: ["Sunrise Mill"], heuristics: false });
    expect(masked).toBe("Works at the {{PERSON_1}}");
  });
});

describe("restore", () => {
  const original =
    "Kavya Testperson (DOB: 12/03/1990), phone 98765 43210, email kavya@example.org, Aadhaar 1234 5678 9012, Door No. 4, Fake Street, Pincode 600042.";

  it("round-trips: restore(mask(x)) === x", () => {
    const { masked, map } = mask(original, { knownNames: ["Kavya Testperson"] });
    expect(findUnmaskedPii(masked)).toEqual([]);
    expect(masked).not.toMatch(/Kavya|98765|1234 5678|example\.org|600042|1990/);
    expect(restore(masked, map).text).toBe(original);
  });

  it("restores tokens with dropped braces and reports unknown tokens", () => {
    const map = { "{{PERSON_1}}": "Kavya" };
    const r = restore("PERSON_1 met {{PERSON_9}} and {{ PERSON_1 }}.", map);
    expect(r.text).toBe("Kavya met {{PERSON_9}} and Kavya.");
    expect(r.unknownTokens).toEqual(["{{PERSON_9}}"]);
  });

  it("restoreDeep handles structured AI output", () => {
    const map = { "{{PERSON_1}}": "Kavya", "{{PLACE_1}}": "Fakepuram" };
    const out = restoreDeep({ summary: "{{PERSON_1}} in {{PLACE_1}}", followUps: [{ task: "Call {{PERSON_1}}", days: 3 }] }, map);
    expect(out).toEqual({ summary: "Kavya in Fakepuram", followUps: [{ task: "Call Kavya", days: 3 }] });
  });
});

describe("server payload guard", () => {
  it("rejects unmasked phone / ID / email", () => {
    expect(findUnmaskedPii("call 9876543210")).toEqual(["phone"]);
    expect(findUnmaskedPii("id 1234 5678 9012")).toEqual(["id"]);
    expect(findUnmaskedPii("x@example.com")).toEqual(["email"]);
    expect(findUnmaskedPii("PAN ABCDE1234F")).toEqual(["id"]);
  });

  it("accepts masked text, tokens and normal numbers", () => {
    expect(findUnmaskedPii("Call {{PHONE_1}} about 3 kits for 120 people on 12/03/2026")).toEqual([]);
  });

  it("checks nested JSON payloads", () => {
    expect(payloadIsSafe({ a: ["ok", { b: "ring +91 98765 43210" }] })).toEqual({ safe: false, kinds: ["phone"] });
    expect(payloadIsSafe({ a: ["{{PHONE_1}}"] }).safe).toBe(true);
  });

  it("is stable across repeated calls (no regex lastIndex leaks)", () => {
    for (let i = 0; i < 5; i++) expect(findUnmaskedPii("9876543210")).toEqual(["phone"]);
  });
});

describe("number validator", () => {
  it("canonicalises Indian formatting and Tamil digits", () => {
    expect(canonicalNumber("1,50,000")).toBe("150000");
    expect(canonicalNumber("௧௨௦")).toBe("120");
    expect(canonicalNumber("12.50")).toBe("12.5");
  });

  it("extracts numbers but ignores digits inside tokens", () => {
    expect(extractNumbers("{{PERSON_1}} gave 1,200 and 45 units on 2026")).toEqual(["1,200", "45", "2026"]);
  });

  it("flags numbers not provided by code", () => {
    const allowed = allowedNumbers([120, "1,50,000", "2026-10-12", 45]);
    const good = validateGenerated("We served 120 people and raised ₹1,50,000 on 12 October 2026 with 45 volunteers.", allowed);
    expect(good.ok).toBe(true);
    const bad = validateGenerated("We served 125 people with 45 volunteers.", allowed);
    expect(bad.ok).toBe(false);
    expect(bad.unverifiedNumbers).toEqual(["125"]);
  });

  it("flags unknown tokens and unprovided titled names", () => {
    const r = validateGenerated("Thanks to {{PERSON_1}} and {{PERSON_7}}. Dr Fakeinvent spoke.", new Set(), {
      issuedTokens: ["{{PERSON_1}}"],
      allowedNames: [],
    });
    expect(r.unknownTokens).toEqual(["{{PERSON_7}}"]);
    expect(r.unverifiedNames).toEqual(["Fakeinvent"]);
    expect(validateGenerated("Dr Testdoc spoke", new Set(), { allowedNames: ["Dr Testdoc"] }).ok).toBe(true);
  });
});
