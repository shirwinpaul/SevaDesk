import { describe, expect, it } from "vitest";
import { mediaCounts, mediaFromCsv, parseCsv } from "@/lib/media";

// Fictional outlets and headlines.
const CSV = `date,outlet,type,language,headline,link,tags
2026-10-12,Fake Daily,print,Tamil,"Blood camp draws 120 donors, organisers say",https://example.org/a,health;camp
15/08/2025,Test TV,television,English,"Volunteers ""step up"" after floods",,relief
2026-01-05,Sample Radio,fm,Tamil,"Line one
line two",,
not-a-date,Bad Outlet,print,English,Broken row,,
2026-02-01,,print,English,No outlet,,`;

let n = 0;
const makeId = () => `m${n++}`;

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    const rows = parseCsv(CSV);
    expect(rows[1]![4]).toBe("Blood camp draws 120 donors, organisers say");
    expect(rows[2]![4]).toBe('Volunteers "step up" after floods');
    expect(rows[3]![4]).toBe("Line one\nline two");
  });

  it("handles CRLF and a BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("media CSV import", () => {
  const r = mediaFromCsv(CSV, makeId, "2026-10-30T00:00:00Z");

  it("imports valid rows, normalising dates (DD/MM/YYYY), types and tags", () => {
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ outlet: "Fake Daily", type: "print", tags: ["health", "camp"], link: "https://example.org/a" });
    expect(r.items[1]).toMatchObject({ date: "2025-08-15", type: "tv" });
    expect(r.items[2]).toMatchObject({ type: "radio" });
  });

  it("reports bad rows with line numbers instead of importing them", () => {
    expect(r.errors.map((e) => e.line)).toEqual([5, 6]);
  });

  it("rejects a file without the required header", () => {
    expect(mediaFromCsv("foo,bar\n1,2", makeId).errors[0]!.line).toBe(1);
  });

  it("rejects non-http links", () => {
    const x = mediaFromCsv("date,outlet,headline,link\n2026-01-01,Fake,Head,javascript:alert(1)", makeId);
    expect(x.items).toHaveLength(0);
  });
});

describe("media counts", () => {
  it("counts by year, outlet, language and type", () => {
    const { items } = mediaFromCsv(CSV, makeId);
    items[0]!.featured = true;
    const c = mediaCounts(items);
    expect(c.total).toBe(3);
    expect(c.byYear).toEqual({ "2026": 2, "2025": 1 });
    expect(c.byLanguage).toEqual({ Tamil: 2, English: 1 });
    expect(c.byType).toEqual({ print: 1, tv: 1, radio: 1 });
    expect(c.byOutlet["Fake Daily"]).toBe(1);
    expect(c.featured).toBe(1);
  });
});
