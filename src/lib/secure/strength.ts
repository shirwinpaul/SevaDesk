/** Rough passphrase strength score 0–4 (for the meter only; min length is enforced separately). */
export const MIN_PASSPHRASE = 10;

export function passphraseStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (p.length < 8) return 0;
  let score = 0;
  if (p.length >= MIN_PASSPHRASE) score++;
  if (p.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes >= 2) score++;
  if (classes >= 3 || p.trim().split(/\s+/).length >= 4) score++;
  if (/^(.)\1+$/.test(p) || /^(password|123456|qwerty)/i.test(p)) score = 0;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}
