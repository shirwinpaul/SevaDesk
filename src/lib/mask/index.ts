// Security-critical: de-identification before any AI request.
// mask() replaces identities with tokens ({{PERSON_1}}, {{PHONE_1}}, …) and returns a
// map so restore() can put the real values back LOCALLY after the AI responds.
// The same value always gets the same token within one masking session.
// Order matters: structured IDs first (so their digits are not mistaken for phones),
// then contact details, dates of birth, addresses, then names and places.

import { AADHAAR_LIKE, ADDRESS, ALNUM_ID, DOB, EMAIL, HONORIFIC, LANDLINE, LONG_NUMBER, MOBILE, PIN_CODE, TOKEN } from "./patterns";

export type TokenKind = "PERSON" | "PLACE" | "PHONE" | "ID" | "EMAIL" | "PIN" | "DOB" | "ADDRESS";
export type MaskMap = Record<string, string>;

export interface MaskOptions {
  /** Names known from case records, volunteers, etc. (always masked). */
  knownNames?: string[];
  /** Places known from case records (village / area). */
  knownPlaces?: string[];
  /** Extra words the user asked to hide in the preview screen. */
  extraTerms?: string[];
  /** Use capitalised-word heuristics to catch names not in records (default true). */
  heuristics?: boolean;
}

export interface MaskResult {
  masked: string;
  map: MaskMap;
}

// Capitalised words that are normally NOT names. Kept short and practical.
const COMMON = new Set(
  (
    "I A An The This That These Those He She They We You It His Her Their Our My Your Its " +
    "Mother Father Son Daughter Husband Wife Brother Sister Grandmother Grandfather Child Children Family Uncle Aunt " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday Today Yesterday Tomorrow Morning Evening Night " +
    "January February March April May June July August September October November December " +
    "Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec " +
    "Government Govt Hospital School College Office Camp Clinic PHC Panchayat Collector Collectorate Taluk District Ward Block Village Town City Street Road " +
    "Aadhaar Ration Card Pension Scheme Certificate Bank Account ID Police Station Court Anganwadi " +
    "Tamil Nadu India Indian English Hindi Chennai " +
    "Mr Mrs Ms Dr Smt Shri Sri Thiru Tmt Selvi Kumari Master Selvan " +
    "Visit Visited Met Need Needs Next Follow Follow-up Action Actions Note Notes Summary Case Status Health Education Livelihood Housing Relief Other " +
    "And But Or If When While After Before Also Then So Because Please Yes No Not None Need Needed " +
    "Blood Donation Medical Eye Relief Ration Distribution Flood Disaster Collection Kit Awareness Rally Tree Plantation Elder Care Workshop Hygiene " +
    "NGO CSR WhatsApp Facebook Instagram Doctor Teacher Volunteer Volunteers Worker Social Team Group Self Help SHG"
  )
    .split(/\s+/)
    .map((w) => w.toLowerCase()),
);

// Words that, when they follow a capitalised sentence-start word, suggest it is a name.
const NAME_FOLLOWERS =
  /^(?:is|was|has|had|said|says|told|asked|lives|lived|needs|needed|wants|went|came|visited|called|works|worked|studies|studied|and|aged|age|w\/o|s\/o|d\/o)\b/i;

const PLACE_PREPOSITIONS = /\b(?:in|at|from|near|to|village|area|town)\s*$/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class Masker {
  map: MaskMap = {};
  private byValue = new Map<string, string>();
  private counters: Partial<Record<TokenKind, number>> = {};

  token(kind: TokenKind, value: string): string {
    const key = `${kind}:${value.trim().toLowerCase().replace(/\s+/g, " ")}`;
    const existing = this.byValue.get(key);
    if (existing) return existing;
    const n = (this.counters[kind] = (this.counters[kind] ?? 0) + 1);
    const tok = `{{${kind}_${n}}}`;
    this.byValue.set(key, tok);
    this.map[tok] = value.trim();
    return tok;
  }
}

/** Apply a replacement to every part of `text` that is NOT already a token. */
function replaceOutsideTokens(text: string, re: RegExp, fn: (m: string, ...groups: string[]) => string): string {
  const parts = text.split(/(\{\{[A-Z]+_\d+\}\})/g);
  return parts
    .map((part, i) => (i % 2 === 1 ? part : part.replace(re, (m: string, ...rest: unknown[]) => fn(m, ...(rest as string[])))))
    .join("");
}

/** Mask a whole-word, case-insensitive list of terms (longest first). */
function maskTerms(text: string, terms: string[], kind: TokenKind, m: Masker): string {
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  let out = text;
  for (const term of clean) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, "giu");
    out = replaceOutsideTokens(out, re, (hit) => m.token(kind, hit));
  }
  return out;
}

/** Split known full names into useful parts ("Kavya Testperson" → also "Kavya", "Testperson"). */
function expandNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    out.add(t);
    for (const part of t.split(/\s+/)) {
      const p = part.replace(/[.,]/g, "");
      if (p.length >= 3 && !COMMON.has(p.toLowerCase())) out.add(p);
    }
  }
  return [...out];
}

/** Heuristic: find capitalised names not in records. Returns candidate strings. */
function findCapitalisedNames(text: string): { persons: string[]; places: string[] } {
  const persons: string[] = [];
  const places: string[] = [];
  const re = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  for (const match of text.matchAll(re)) {
    const phrase = match[0];
    const start = match.index ?? 0;
    const before = text.slice(0, start);
    const after = text.slice(start + phrase.length).trimStart();
    // Drop common leading/trailing words ("The Kumar" → "Kumar").
    const words = phrase.split(/\s+/).filter((w) => !COMMON.has(w.toLowerCase()));
    if (words.length === 0) continue;
    const candidate = words.join(" ");
    const atSentenceStart = /(?:^|[.!?:;\n]\s*|["“(]\s*)$/.test(before);
    if (atSentenceStart && words.length === phrase.split(/\s+/).length && phrase.split(/\s+/).length === 1) {
      // A single capitalised word starting a sentence is only a name if a name-like verb follows.
      if (!NAME_FOLLOWERS.test(after)) continue;
    }
    if (PLACE_PREPOSITIONS.test(before)) places.push(candidate);
    else persons.push(candidate);
  }
  return { persons, places };
}

export function mask(text: string, opts: MaskOptions = {}): MaskResult {
  const m = new Masker();
  let out = text;

  // 1. Structured identifiers.
  out = replaceOutsideTokens(out, EMAIL, (hit) => m.token("EMAIL", hit));
  out = replaceOutsideTokens(out, AADHAAR_LIKE, (hit) => m.token("ID", hit));
  out = replaceOutsideTokens(out, ALNUM_ID, (hit) => m.token("ID", hit));
  out = replaceOutsideTokens(out, LANDLINE, (hit) => m.token("PHONE", hit));
  out = replaceOutsideTokens(out, MOBILE, (hit) => m.token("PHONE", hit));
  out = replaceOutsideTokens(out, LONG_NUMBER, (hit) => m.token("ID", hit));

  // 2. Dates of birth (keep the keyword, mask the date).
  out = replaceOutsideTokens(out, DOB, (_hit, kw, date) => `${kw}${m.token("DOB", date ?? "")}`);

  // 3. Addresses and PIN codes.
  out = replaceOutsideTokens(out, ADDRESS, (hit) => m.token("ADDRESS", hit));
  out = replaceOutsideTokens(out, PIN_CODE, (hit) => {
    const digits = hit.match(/[1-9]\d{2}\s?\d{3}$/)?.[0] ?? hit;
    return hit.slice(0, hit.length - digits.length) + m.token("PIN", digits);
  });

  // 4. Known names / places / user-chosen terms.
  out = maskTerms(out, expandNames([...(opts.knownNames ?? []), ...(opts.extraTerms ?? [])]), "PERSON", m);
  out = maskTerms(out, opts.knownPlaces ?? [], "PLACE", m);

  // 5. Heuristics: honorific + Name, then capitalised words.
  if (opts.heuristics !== false) {
    out = replaceOutsideTokens(out, HONORIFIC, (_hit, title, name) => `${title} ${m.token("PERSON", name ?? "")}`);
    const { persons, places } = findCapitalisedNames(out);
    out = maskTerms(out, places, "PLACE", m);
    // Mask every occurrence of a detected name, including at sentence starts.
    out = maskTerms(out, expandNames(persons), "PERSON", m);
  }

  return { masked: out, map: m.map };
}

export interface RestoreResult {
  text: string;
  /** Tokens in the AI output that we never issued (possible hallucination). */
  unknownTokens: string[];
}

/** Put real values back, locally. Also handles tokens whose braces the model dropped. */
export function restore(text: string, map: MaskMap): RestoreResult {
  const unknown = new Set<string>();
  let out = text.replace(TOKEN, (whole, inner: string) => {
    const key = `{{${inner}}}`;
    if (key in map) return map[key]!;
    unknown.add(key);
    return whole;
  });
  for (const [tok, value] of Object.entries(map)) {
    const bare = tok.slice(2, -2);
    out = out.replace(new RegExp(`(?<![\\w{])${bare}(?![\\w}])`, "g"), value);
  }
  return { text: out, unknownTokens: [...unknown] };
}

/** Restore every string inside a JSON-like value (for structured AI output). */
export function restoreDeep<T>(value: T, map: MaskMap, unknown: Set<string> = new Set()): T {
  if (typeof value === "string") {
    const r = restore(value, map);
    r.unknownTokens.forEach((u) => unknown.add(u));
    return r.text as T;
  }
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, map, unknown)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreDeep(v, map, unknown)])) as T;
  }
  return value;
}
