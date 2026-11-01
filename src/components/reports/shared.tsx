"use client";

import { Fragment, useMemo } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { canonicalNumber, extractNumbers, type ValidationResult } from "@/lib/validate/numbers";
import type { ImpactData } from "@/lib/reports/metrics";
import { CampSchema, CaseSchema, DonationSchema, TaskSchema, VolunteerSchema } from "@/types/models";

export function useImpactData(): ImpactData & { loading: boolean } {
  const cases = useCollection("cases", CaseSchema);
  const tasks = useCollection("tasks", TaskSchema);
  const camps = useCollection("camps", CampSchema);
  const volunteers = useCollection("volunteers", VolunteerSchema);
  const donations = useCollection("donations", DonationSchema);
  return useMemo(
    () => ({
      cases: cases.items,
      tasks: tasks.items,
      camps: camps.items,
      volunteers: volunteers.items,
      donations: donations.items,
      loading: cases.loading || camps.loading,
    }),
    [cases.items, tasks.items, camps.items, volunteers.items, donations.items, cases.loading, camps.loading],
  );
}

/** Shows ✅ or ⚠️ with the list of numbers that did not come from the user's records. */
export function ValidationBanner({ result }: { result: ValidationResult | null }) {
  const { t } = useUiPrefs();
  if (!result) return null;
  if (result.ok) return <p className="badge border-leaf-600 text-leaf-700 dark:text-green-200 py-2" role="status">{t.reports.verified}</p>;
  const all = [...result.unverifiedNumbers, ...result.unknownTokens, ...result.unverifiedNames];
  return (
    <div role="alert" className="rounded-xl border-2 border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100 p-3 space-y-1">
      <p className="font-bold">{t.reports.unverified}</p>
      <p>{fmt(t.reports.unverifiedList, { list: all.join(", ") })}</p>
    </div>
  );
}

/** Renders text with unverified numbers highlighted (<mark>). */
export function HighlightedText({ text, flagged }: { text: string; flagged: string[] }) {
  const bad = useMemo(() => new Set(flagged.map(canonicalNumber)), [flagged]);
  if (!bad.size) return <span className="whitespace-pre-wrap">{text}</span>;
  const nums = extractNumbers(text);
  const parts: Array<{ s: string; flag: boolean }> = [];
  let rest = text;
  for (const n of nums) {
    const i = rest.indexOf(n);
    if (i < 0) continue;
    parts.push({ s: rest.slice(0, i), flag: false }, { s: n, flag: bad.has(canonicalNumber(n)) });
    rest = rest.slice(i + n.length);
  }
  parts.push({ s: rest, flag: false });
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.flag ? (
          <mark key={i} className="bg-red-200 text-red-900 rounded px-0.5" title="⚠️">
            {p.s}⚠️
          </mark>
        ) : (
          <Fragment key={i}>{p.s}</Fragment>
        ),
      )}
    </span>
  );
}
