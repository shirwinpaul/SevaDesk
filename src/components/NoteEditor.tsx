"use client";

import { useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { nextStepsToFollowUps, reviseNote } from "@/lib/notes";
import { dateInZone } from "@/lib/tasks";
import { caseLabel, CaseSchema, FieldNoteSchema, type FieldNote, type NoteTemplate, type OrganisedNote } from "@/types/models";
import { FollowUpSuggestions } from "./FollowUpSuggestions";
import { OrganiseNoteButton } from "./OrganiseNote";
import { VoiceButton } from "./VoiceButton";
import { LiveMessage, Modal, Select, TextArea, TextInput } from "./ui";

const EMPTY_TEMPLATE: NoteTemplate = { saw: "", needs: "", actions: "", nextSteps: "" };
const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Editable view of a structured (organised) note. */
function OrganisedEditor({ value, onChange }: { value: OrganisedNote; onChange: (v: OrganisedNote) => void }) {
  const { t } = useUiPrefs();
  return (
    <div className="space-y-3 rounded-xl border border-teal-600 p-3" aria-live="polite">
      <h3 className="font-semibold">✨ {t.notes.organised}</h3>
      <TextArea label={t.notes.summary} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} />
      <TextArea
        label={t.notes.needsIdentified}
        value={value.needsIdentified.map((n) => `${n.category}: ${n.description}`).join("\n")}
        onChange={(e) =>
          onChange({
            ...value,
            needsIdentified: lines(e.target.value).map((l) => {
              const [cat, ...rest] = l.split(":");
              return rest.length ? { category: cat!.trim(), description: rest.join(":").trim() } : { category: "other", description: l };
            }),
          })
        }
      />
      <TextArea label={t.notes.actions} value={value.actionsTaken.join("\n")} onChange={(e) => onChange({ ...value, actionsTaken: lines(e.target.value) })} />
      <TextArea
        label={t.notes.referralsMentioned}
        value={value.referralsMentioned.join("\n")}
        onChange={(e) => onChange({ ...value, referralsMentioned: lines(e.target.value) })}
      />
    </div>
  );
}

export function NoteEditor({ open, onClose, existing, defaultCaseId = "" }: { open: boolean; onClose: () => void; existing?: FieldNote; defaultCaseId?: string }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("notes", FieldNoteSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  const [caseId, setCaseId] = useState(existing?.caseId ?? defaultCaseId);
  const [date, setDate] = useState(existing?.date ?? dateInZone(new Date()));
  const [time, setTime] = useState(existing?.time ?? new Date().toTimeString().slice(0, 5));
  const [place, setPlace] = useState(existing?.place ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [template, setTemplate] = useState<NoteTemplate>(existing?.template ?? EMPTY_TEMPLATE);
  const [organised, setOrganised] = useState<OrganisedNote | null>(existing?.organised ?? null);
  const [suggestions, setSuggestions] = useState<OrganisedNote["followUps"]>([]);
  const [suggestKey, setSuggestKey] = useState(0);
  const [msg, setMsg] = useState("");

  const setTpl = (k: keyof NoteTemplate, v: string) => setTemplate((p) => ({ ...p, [k]: v }));
  const caseRecord = cases.find((c) => c.id === caseId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const content = { text, template, organised, caseId, date, time, place };
    if (existing) await save(reviseNote(existing, content, now));
    else await save({ id: newId(), ...content, createdAt: now, updatedAt: now });
    setMsg(t.common.saved);
    // Template next steps → confirmable follow-ups (AI ones were offered when organising).
    const fromTemplate = nextStepsToFollowUps(template.nextSteps);
    if (fromTemplate.length && !suggestions.length) {
      setSuggestions(fromTemplate);
      setSuggestKey((k) => k + 1);
    } else onClose();
  }

  return (
    <Modal open={open} title={existing ? t.notes.editNote : t.notes.newNote} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label={t.notes.case}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          options={[
            { value: "", label: t.notes.generalVisit },
            ...[...cases].sort((a, b) => b.number - a.number).map((c) => ({ value: c.id, label: `${caseLabel(c.number)} · ${c.displayName}` })),
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t.common.date} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          <TextInput label={t.notes.time} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <TextInput label={t.notes.place} value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
        <TextArea label={t.notes.note} placeholder={t.notes.notePlaceholder} rows={6} value={text} maxLength={20_000} onChange={(e) => setText(e.target.value)} />
        <p className="text-sm muted">🔒 {t.notes.typingSafer}</p>
        <VoiceButton onText={(s) => setText((prev) => (prev ? `${prev} ${s}` : s))} />

        <OrganiseNoteButton
          text={text}
          caseRecord={caseRecord}
          place={place}
          onResult={(o) => {
            setOrganised(o);
            setSuggestions(o.followUps);
            setSuggestKey((k) => k + 1);
          }}
        />
        {organised && <OrganisedEditor value={organised} onChange={setOrganised} />}

        <details className="rounded-xl border border-[var(--border)] p-3" open={!organised && !!existing?.template.saw}>
          <summary className="cursor-pointer font-semibold min-h-[40px] flex items-center">📝 {t.notes.template}</summary>
          <p className="text-sm muted mb-2">{t.notes.templateHelp}</p>
          <div className="space-y-3">
            <TextArea label={t.notes.saw} value={template.saw} onChange={(e) => setTpl("saw", e.target.value)} />
            <TextArea label={t.notes.needs} value={template.needs} onChange={(e) => setTpl("needs", e.target.value)} />
            <TextArea label={t.notes.actions} value={template.actions} onChange={(e) => setTpl("actions", e.target.value)} />
            <TextArea label={t.notes.nextSteps} value={template.nextSteps} onChange={(e) => setTpl("nextSteps", e.target.value)} />
          </div>
        </details>

        {suggestions.length > 0 && <FollowUpSuggestions key={suggestKey} suggestions={suggestions} caseId={caseId} />}

        {existing && existing.history.length > 0 && (
          <details className="rounded-xl border border-[var(--border)] p-3">
            <summary className="cursor-pointer font-semibold min-h-[40px] flex items-center">
              🕘 {t.notes.history} · {fmt(t.notes.versions, { n: existing.history.length })}
            </summary>
            <ol className="space-y-3 mt-2">
              {[...existing.history].reverse().map((h, i) => (
                <li key={i} className="border-l-4 border-teal-600 pl-3">
                  <p className="text-sm muted">{fmt(t.notes.savedAt, { date: new Date(h.savedAt).toLocaleString() })}</p>
                  <p className="whitespace-pre-wrap">{h.text || h.template?.saw || "—"}</p>
                </li>
              ))}
            </ol>
          </details>
        )}

        <LiveMessage message={msg} tone="success" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.close}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
