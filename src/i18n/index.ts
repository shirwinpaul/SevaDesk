import { en, type Dict } from "./en";
import { ta } from "./ta";

export type Lang = "en" | "ta";
export const dictionaries: Record<Lang, Dict> = { en, ta };
export type { Dict };

/** Replace `{name}` placeholders with values. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** BCP-47 tag for the HTML `lang` attribute and Intl formatting. */
export function langTag(lang: Lang): string {
  return lang === "ta" ? "ta-IN" : "en-IN";
}
