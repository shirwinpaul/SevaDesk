// Principle 4: facts and numbers come from the user, never the AI.
// validateGenerated() flags any number in AI-written text that is not one of the
// values the code provided, and any token or titled name that we did not provide.

import { TOKEN } from "@/lib/mask/patterns";

const TAMIL_DIGITS = "௦௧௨௩௪௫௬௭௮௯";

function normaliseDigits(s: string): string {
  return s.replace(/[௦-௯]/g, (d) => String(TAMIL_DIGITS.indexOf(d)));
}

/** Canonical numeric form: "1,50,000" → "150000", "12.50" → "12.5", "05" → "5". */
export function canonicalNumber(raw: string): string {
  const n = Number(normaliseDigits(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? String(n) : raw;
}

const NUMBER = /(?<![\w.])[0-9௦-௯]+(?:,[0-9௦-௯]{2,3})*(?:\.[0-9௦-௯]+)?(?![\w])/g;

/** All numbers in a text (as written), ignoring digits inside {{TOKENS_1}}. */
export function extractNumbers(text: string): string[] {
  const stripped = text.replace(TOKEN, " ");
  return [...stripped.matchAll(NUMBER)].map((m) => m[0]);
}

/**
 * Build the allowed set from code-provided values. Strings are scanned for every
 * number they contain, so a date "2026-10-12" allows 2026, 10 and 12.
 */
export function allowedNumbers(values: ReadonlyArray<string | number | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number") out.add(canonicalNumber(String(v)));
    else for (const n of v.match(/\d+(?:,\d{2,3})*(?:\.\d+)?/g) ?? []) out.add(canonicalNumber(n));
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  /** Numbers in the text that were not provided by code (as written). */
  unverifiedNumbers: string[];
  /** Tokens left in the text that we never issued. */
  unknownTokens: string[];
  /** "Mr X"-style names that were not provided. */
  unverifiedNames: string[];
}

const TITLED_NAME = /\b(?:Mr|Mrs|Ms|Dr|Smt|Shri|Sri|Thiru|Tmt|Selvi)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;

export function validateGenerated(
  text: string,
  allowed: Set<string>,
  opts: { allowedNames?: string[]; issuedTokens?: string[] } = {},
): ValidationResult {
  const unverifiedNumbers = [...new Set(extractNumbers(text).filter((n) => !allowed.has(canonicalNumber(n))))];
  const issued = new Set(opts.issuedTokens ?? []);
  const unknownTokens = [...new Set([...text.matchAll(TOKEN)].map((m) => `{{${m[1]}}}`).filter((t) => !issued.has(t)))];
  const names = (opts.allowedNames ?? []).map((n) => n.toLowerCase());
  const unverifiedNames = [
    ...new Set(
      [...text.matchAll(TITLED_NAME)]
        .map((m) => m[1]!)
        .filter((n) => !names.some((a) => a.includes(n.toLowerCase()) || n.toLowerCase().includes(a))),
    ),
  ];
  return {
    ok: unverifiedNumbers.length === 0 && unknownTokens.length === 0 && unverifiedNames.length === 0,
    unverifiedNumbers,
    unknownTokens,
    unverifiedNames,
  };
}
