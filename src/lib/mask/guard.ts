// Security-critical, server side: defence in depth. Even though the browser masks text
// before sending, AI routes call this and REJECT any payload that still contains an
// unmasked phone number, ID-like number or email. Never logs the payload.

import { AADHAAR_LIKE, ALNUM_ID, EMAIL, LANDLINE, LONG_NUMBER, MOBILE, TOKEN } from "./patterns";

export type PiiKind = "email" | "phone" | "id";

const CHECKS: Array<[PiiKind, RegExp]> = [
  ["email", EMAIL],
  ["id", AADHAAR_LIKE],
  ["id", ALNUM_ID],
  ["phone", LANDLINE],
  ["phone", MOBILE],
  ["id", LONG_NUMBER],
];

/** Returns the kinds of unmasked identifiers found (empty = safe). */
export function findUnmaskedPii(text: string): PiiKind[] {
  let rest = text.replace(TOKEN, " ");
  const found = new Set<PiiKind>();
  for (const [kind, re] of CHECKS) {
    // String.replace with a global regex always starts at 0 (no shared lastIndex state).
    // Matched parts are blanked so one number is reported once, under its most specific kind.
    rest = rest.replace(re, () => {
      found.add(kind);
      return " ";
    });
  }
  return [...found];
}

/** Collect every string inside an arbitrary JSON value. */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

export function payloadIsSafe(payload: unknown): { safe: boolean; kinds: PiiKind[] } {
  const kinds = new Set<PiiKind>();
  for (const s of collectStrings(payload)) findUnmaskedPii(s).forEach((k) => kinds.add(k));
  return { safe: kinds.size === 0, kinds: [...kinds] };
}
