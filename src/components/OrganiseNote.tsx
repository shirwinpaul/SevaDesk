"use client";

import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { maskContext } from "@/lib/ai/client";
import { mask } from "@/lib/mask";
import { CaseSchema, VolunteerSchema, type Case, type OrganisedNote } from "@/types/models";
import { AiButton } from "./AiButton";

/** "✨ Organise this note" — the note is masked before it leaves the device. */
export function OrganiseNoteButton({ text, caseRecord, place, onResult }: { text: string; caseRecord?: Case; place: string; onResult: (o: OrganisedNote) => void }) {
  const { t, prefs } = useUiPrefs();
  const { items: cases } = useCollection("cases", CaseSchema);
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);

  return (
    <AiButton
      task="organiseNote"
      module="notes"
      label={t.ai.organise}
      disabled={!text.trim()}
      prepare={(extraTerms) => {
        const ctx = maskContext({ cases: caseRecord ? [caseRecord, ...cases] : cases, volunteers, places: [place], extraTerms });
        const { masked, map } = mask(text, ctx);
        return { input: { note: masked, uiLang: prefs.lang }, map };
      }}
      onResult={(o) => onResult(o)}
    />
  );
}
