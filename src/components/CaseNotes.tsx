"use client";

import { useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { caseLabel, CaseSchema, FieldNoteSchema, type FieldNote } from "@/types/models";
import { NoteEditor } from "./NoteEditor";

export function NoteList({ notes, showCase = true }: { notes: FieldNote[]; showCase?: boolean }) {
  const { t } = useUiPrefs();
  const { items: cases } = useCollection("cases", CaseSchema);
  const [editing, setEditing] = useState<FieldNote | null>(null);
  const sorted = [...notes].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <>
      <ul className="space-y-3">
        {sorted.map((n) => {
          const c = cases.find((x) => x.id === n.caseId);
          const preview = n.organised?.summary || n.text || n.template.saw;
          return (
            <li key={n.id}>
              <button type="button" className="card w-full text-left hover:border-teal-600 space-y-1" onClick={() => setEditing(n)}>
                <p className="text-sm muted flex flex-wrap gap-x-3">
                  <span>
                    📅 {n.date} {n.time}
                  </span>
                  {n.place && <span>📍 {n.place}</span>}
                  {showCase && <span>📁 {c ? `${caseLabel(c.number)} · ${c.displayName}` : t.notes.generalVisit}</span>}
                  {n.organised && <span>✨ {t.notes.organised}</span>}
                  {n.history.length > 0 && <span>🕘 {fmt(t.notes.versions, { n: n.history.length })}</span>}
                </p>
                <p className="line-clamp-3 whitespace-pre-wrap">{preview || "—"}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {editing && <NoteEditor open existing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Notes section on a case page. */
export function CaseNotes({ caseId }: { caseId: string }) {
  const { t } = useUiPrefs();
  const { items } = useCollection("notes", FieldNoteSchema);
  const [open, setOpen] = useState(false);
  const notes = items.filter((n) => n.caseId === caseId);
  return (
    <section className="card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🗒️ {t.cases.linkedNotes}</h2>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          + {t.cases.addNote}
        </button>
      </div>
      {notes.length === 0 ? <p className="muted">{t.cases.noNotes}</p> : <NoteList notes={notes} showCase={false} />}
      {open && <NoteEditor open defaultCaseId={caseId} onClose={() => setOpen(false)} />}
    </section>
  );
}
