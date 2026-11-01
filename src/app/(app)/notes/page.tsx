"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { NoteList } from "@/components/CaseNotes";
import { NoteEditor } from "@/components/NoteEditor";
import { NotebookIllustration } from "@/components/Illustrations";
import { EmptyState, PageHeader, Select, Spinner } from "@/components/ui";
import { caseLabel, CaseSchema, FieldNoteSchema } from "@/types/models";

export default function NotesPage() {
  const { t } = useUiPrefs();
  const { items: notes, loading } = useCollection("notes", FieldNoteSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  // Children of the vault gate render only on the client, so reading the URL here is safe.
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("new"));
  const [filter, setFilter] = useState("all");

  const shown = filter === "all" ? notes : notes.filter((n) => n.caseId === (filter === "general" ? "" : filter));

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title={t.notes.title}
        icon="🗒️"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            + {t.notes.newNote}
          </button>
        }
      />
      <Select
        label={t.notes.filterCase}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        options={[
          { value: "all", label: t.notes.allNotes },
          { value: "general", label: t.notes.generalVisit },
          ...cases.map((c) => ({ value: c.id, label: `${caseLabel(c.number)} · ${c.displayName}` })),
        ]}
      />
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : shown.length === 0 ? (
        <EmptyState text={t.notes.noNotes}>
          <NotebookIllustration className="mx-auto w-24 h-auto" />
        </EmptyState>
      ) : (
        <NoteList notes={shown} />
      )}
      {open && <NoteEditor open onClose={() => setOpen(false)} />}
    </div>
  );
}
