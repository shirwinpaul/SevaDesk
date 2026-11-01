"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { maskContext } from "@/lib/ai/client";
import { mask, restore, type MaskMap } from "@/lib/mask";
import { CaseSchema, FieldNoteSchema, VolunteerSchema, type Case } from "@/types/models";
import { AiButton } from "./AiButton";
import { copyText, TextArea, TextInput } from "./ui";

/**
 * Referral-letter draft. The draft stays MASKED while the user edits it; real names
 * are restored locally only when they press "Create final copy".
 */
export function CaseSummaryButton({ caseRecord }: { caseRecord: Case }) {
  const { t, prefs } = useUiPrefs();
  const { items: notes } = useCollection("notes", FieldNoteSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);
  const [purpose, setPurpose] = useState("");
  const [draft, setDraft] = useState("");
  const [map, setMap] = useState<MaskMap>({});
  const [final, setFinal] = useState("");

  return (
    <section className="card space-y-3 no-print">
      <h2 className="text-lg font-semibold">✉️ {t.ai.caseSummaryTitle}</h2>
      <TextInput label={t.ai.purpose} value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
      <AiButton
        task="caseSummary"
        module="cases"
        label={t.cases.prepareSummary}
        keepTokens
        prepare={(extraTerms) => {
          const ctx = maskContext({ cases: [caseRecord, ...cases], volunteers, extraTerms });
          const caseNotes = notes
            .filter((n) => n.caseId === caseRecord.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5)
            .map((n) => `${n.date}: ${n.organised?.summary || n.text || n.template.saw}`.slice(0, 1500));
          // One masking session for the whole request so tokens stay consistent.
          const SEP = "\n⁣\n";
          const joined = [purpose, `Case ${caseRecord.displayName}`, ...caseRecord.referrals.map((r) => `${r.to}: ${r.note}`), ...caseNotes].join(SEP);
          const { masked, map } = mask(joined, ctx);
          const [mPurpose = "", , ...rest] = masked.split(SEP);
          const nRef = caseRecord.referrals.length;
          return {
            input: {
              categories: caseRecord.categories,
              status: caseRecord.status,
              referrals: rest.slice(0, nRef),
              notes: rest.slice(nRef),
              purpose: mPurpose || "referral",
              lang: prefs.lang,
            },
            map,
          };
        }}
        onResult={(o, meta) => {
          setMap(meta.map);
          setFinal("");
          setDraft(
            [o.summary, "", ...o.needs.map((n) => `• ${n}`), "", ...o.actionsSoFar.map((a) => `• ${a}`), "", o.requestToAgency].join("\n").trim(),
          );
        }}
      />
      {draft && (
        <>
          <p className="text-sm muted">{t.ai.caseSummaryHelp}</p>
          <TextArea label={t.ai.caseSummaryTitle} rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => setFinal(restore(draft, map).text)}>
            {t.ai.makeFinal}
          </button>
          <p className="text-xs muted">{t.ai.disclaimer}</p>
        </>
      )}
      {final && (
        <>
          <TextArea label={t.ai.finalCopy} rows={10} value={final} onChange={(e) => setFinal(e.target.value)} />
          <button type="button" className="btn btn-ghost" onClick={() => void copyText(final)}>
            📋 {t.common.copy}
          </button>
        </>
      )}
    </section>
  );
}
