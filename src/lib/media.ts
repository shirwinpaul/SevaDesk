// Media archive: CSV import and coverage counts (pure code).

import { MEDIA_TYPES, MediaItemSchema, type MediaItem, type MediaType } from "@/types/models";

/** RFC 4180-style CSV parser: quoted fields, escaped quotes, commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export const CSV_COLUMNS = ["date", "outlet", "type", "language", "headline", "link", "tags"] as const;

const TYPE_ALIASES: Record<string, MediaType> = { newspaper: "print", paper: "print", television: "tv", web: "online", website: "online", fm: "radio" };

function normaliseDate(s: string): string | null {
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v); // DD/MM/YYYY (Indian order)
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

export interface CsvImportResult {
  items: MediaItem[];
  errors: Array<{ line: number; reason: string }>;
}

/** Header row required (any column order). Rows that fail validation are reported, not imported. */
export function mediaFromCsv(text: string, makeId: () => string, now = new Date().toISOString()): CsvImportResult {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("date") < 0 || col("outlet") < 0 || col("headline") < 0) {
    return { items: [], errors: [{ line: 1, reason: "Header must include date, outlet, headline" }] };
  }
  const items: MediaItem[] = [];
  const errors: CsvImportResult["errors"] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
    const date = normaliseDate(get("date"));
    const rawType = get("type").toLowerCase();
    const type = (MEDIA_TYPES as readonly string[]).includes(rawType) ? (rawType as MediaType) : (TYPE_ALIASES[rawType] ?? "print");
    const parsed = MediaItemSchema.safeParse({
      id: makeId(),
      outlet: get("outlet"),
      type,
      language: get("language"),
      date,
      headline: get("headline"),
      link: get("link"),
      tags: get("tags")
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
      createdAt: now,
    });
    if (parsed.success) items.push(parsed.data);
    else errors.push({ line: i + 2, reason: parsed.error.issues.map((x) => x.path.join(".") || x.message).join(", ") });
  });
  return { items, errors };
}

export interface MediaCounts {
  total: number;
  byYear: Record<string, number>;
  byOutlet: Record<string, number>;
  byLanguage: Record<string, number>;
  byType: Record<string, number>;
  featured: number;
}

export function mediaCounts(items: MediaItem[]): MediaCounts {
  const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  const out: MediaCounts = { total: items.length, byYear: {}, byOutlet: {}, byLanguage: {}, byType: {}, featured: 0 };
  for (const m of items) {
    inc(out.byYear, m.date.slice(0, 4));
    inc(out.byOutlet, m.outlet);
    inc(out.byLanguage, m.language || "—");
    inc(out.byType, m.type);
    if (m.featured) out.featured++;
  }
  return out;
}
