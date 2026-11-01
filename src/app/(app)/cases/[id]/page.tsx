"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { CaseForm, CaseStatusBadge } from "@/components/CaseForm";
import { TaskForm, TaskItem } from "@/components/tasks";
import { EmptyState, PageHeader, Spinner, TextInput } from "@/components/ui";
import { CaseNotes } from "@/components/CaseNotes";
import { CaseSummaryButton } from "@/components/CaseSummary";
import { dateInZone } from "@/lib/tasks";
import { caseLabel, CaseSchema, FieldNoteSchema, ResourceSchema, TaskSchema, VolunteerSchema, type Case } from "@/types/models";

export default function CaseDetailPage() {
  const { t } = useUiPrefs();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { items: cases, loading, save, remove } = useCollection("cases", CaseSchema);
  const { items: tasks, remove: removeTask } = useCollection("tasks", TaskSchema);
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);
  const { items: notes, remove: removeNote } = useCollection("notes", FieldNoteSchema);
  // Referral suggestions come only from the user's own Resource Directory.
  const { items: resources } = useCollection("resources", ResourceSchema);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [newDoc, setNewDoc] = useState("");
  const [refTo, setRefTo] = useState("");
  const [refNote, setRefNote] = useState("");

  const c = cases.find((x) => x.id === params.id);
  if (loading) return <Spinner label={t.common.loading} />;
  if (!c) return <EmptyState text={t.cases.notFound}><Link href="/cases" className="btn btn-ghost">{t.common.back}</Link></EmptyState>;

  const update = (patch: Partial<Case>) => save({ ...c, ...patch, updatedAt: new Date().toISOString() });
  const caseTasks = tasks.filter((x) => x.caseId === c.id).sort((a, b) => a.status.localeCompare(b.status) || a.dueDate.localeCompare(b.dueDate));
  const today = dateInZone(new Date());
  const assigned = volunteers.find((v) => v.id === c.assignedTo)?.name;

  async function deleteCase() {
    if (!c || !window.confirm(t.common.confirmDelete)) return;
    for (const task of caseTasks) await removeTask(task.id);
    for (const note of notes.filter((n) => n.caseId === c.id)) await removeNote(note.id);
    await remove(c.id);
    router.push("/cases");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/cases" className="btn btn-ghost no-print">
        ← {t.cases.title}
      </Link>
      <PageHeader
        title={`${caseLabel(c.number)} · ${c.displayName}`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(true)}>
            ✏️ {t.common.edit}
          </button>
        }
      />

      <section className="card grid gap-2 sm:grid-cols-2">
        <p>
          {t.common.status}: <CaseStatusBadge status={c.status} />
        </p>
        <p>
          {t.cases.consent}: <strong>{t.cases.consentValue[c.consent]}</strong>
        </p>
        {c.phone && (
          <p>
            {t.common.phone}: <a className="underline" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>
          </p>
        )}
        {c.area && <p>📍 {c.area}</p>}
        <p>
          {t.cases.assignedTo}: {assigned ?? t.cases.unassigned}
        </p>
        <p className="muted text-sm">
          {t.cases.created}: {c.createdAt.slice(0, 10)}
        </p>
        <p className="sm:col-span-2 flex flex-wrap gap-1">
          {c.categories.map((x) => (
            <span key={x} className="badge">
              {t.cases.category[x]}
            </span>
          ))}
        </p>
        {c.consent === "no" && <p className="sm:col-span-2 text-sm text-red-700 dark:text-red-300">⚠️ {t.cases.consentNoWarning}</p>}
      </section>

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">✅ {t.cases.tasks}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setTaskOpen(true)}>
            + {t.tasks.newTask}
          </button>
        </div>
        {caseTasks.length === 0 ? (
          <p className="muted">{t.tasks.empty}</p>
        ) : (
          <ul>
            {caseTasks.map((task) => (
              <TaskItem key={task.id} task={task} overdue={task.status === "open" && task.dueDate < today} />
            ))}
          </ul>
        )}
      </section>

      <CaseNotes caseId={c.id} />

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">📋 {t.cases.documents}</h2>
        <p className="text-sm muted">{t.cases.documentsHelp}</p>
        <ul>
          {c.documents.map((d, i) => (
            <li key={`${d.label}-${i}`}>
              <label className="flex items-center gap-3 min-h-[44px]">
                <input
                  type="checkbox"
                  className="w-6 h-6 accent-teal-700"
                  checked={d.done}
                  onChange={() => void update({ documents: c.documents.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                />
                {d.label}
              </label>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newDoc.trim()) return;
            void update({ documents: [...c.documents, { label: newDoc.trim(), done: false }] });
            setNewDoc("");
          }}
        >
          <div className="flex-1">
            <TextInput label={t.cases.addDocument} value={newDoc} maxLength={80} onChange={(e) => setNewDoc(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-ghost">
            {t.common.add}
          </button>
        </form>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">↗️ {t.cases.referrals}</h2>
        <ul className="space-y-1">
          {c.referrals.map((r) => (
            <li key={r.id} className="border-b border-[var(--border)] py-1">
              <strong>{r.to}</strong> <span className="muted text-sm">· {r.date}</span>
              {r.note && <p className="text-sm">{r.note}</p>}
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!refTo.trim()) return;
            void update({ referrals: [...c.referrals, { id: newId(), to: refTo.trim(), date: today, note: refNote.trim() }] });
            setRefTo("");
            setRefNote("");
          }}
        >
          <TextInput label={t.cases.referralTo} list="resource-names" value={refTo} maxLength={120} onChange={(e) => setRefTo(e.target.value)} />
          <datalist id="resource-names">
            {resources.map((r) => (
              <option key={r.id} value={r.name} />
            ))}
          </datalist>
          <TextInput label={t.common.notes} value={refNote} maxLength={500} onChange={(e) => setRefNote(e.target.value)} />
          <button type="submit" className="btn btn-ghost">
            {t.cases.addReferral}
          </button>
        </form>
      </section>

      <CaseSummaryButton caseRecord={c} />

      <button type="button" className="btn btn-danger no-print" onClick={deleteCase}>
        🗑️ {t.cases.deleteCase}
      </button>

      {editOpen && <CaseForm open existing={c} onClose={() => setEditOpen(false)} />}
      {taskOpen && <TaskForm open defaultCaseId={c.id} onClose={() => setTaskOpen(false)} />}
    </div>
  );
}
