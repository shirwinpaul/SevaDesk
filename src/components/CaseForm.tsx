"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useVault } from "@/hooks/useVault";
import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  CaseSchema,
  CONSENT_VALUES,
  SettingsSchema,
  defaultSettings,
  VolunteerSchema,
  type Case,
  type CaseCategory,
} from "@/types/models";
import { Modal, Select, TextInput } from "./ui";

/** Create (no `existing`) or edit a case. New cases get the next human-friendly number. */
export function CaseForm({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Case;
  onSaved?: (c: Case) => void;
}) {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);
  const [name, setName] = useState(existing?.displayName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [area, setArea] = useState(existing?.area ?? "");
  const [cats, setCats] = useState<CaseCategory[]>(existing?.categories ?? []);
  const [status, setStatus] = useState<Case["status"]>(existing?.status ?? "new");
  const [consent, setConsent] = useState<Case["consent"] | "">(existing?.consent ?? "");
  const [assignedTo, setAssignedTo] = useState(existing?.assignedTo ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !consent) return;
    setBusy(true);
    const now = new Date().toISOString();
    let number = existing?.number;
    if (!number) {
      const settings = (await session.get("settings", "main", SettingsSchema)) ?? defaultSettings();
      number = settings.caseCounter + 1;
      await session.save("settings", SettingsSchema, { ...settings, caseCounter: number });
    }
    const saved = await session.save("cases", CaseSchema, {
      ...(existing ?? {
        id: newId(),
        createdAt: now,
        documents: t.cases.documentDefaults.map((label) => ({ label, done: false })),
      }),
      number,
      displayName: name.trim(),
      phone: phone.trim(),
      area: area.trim(),
      categories: cats,
      status,
      consent,
      assignedTo,
      updatedAt: now,
      closedAt: status === "closed" ? (existing?.closedAt ?? now) : null,
    });
    setBusy(false);
    onSaved?.(saved);
    onClose();
  }

  const toggleCat = (c: CaseCategory) => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Modal open={open} title={existing ? t.cases.editCase : t.cases.newCase} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-saffron-100 text-saffron-700 dark:bg-transparent dark:text-saffron-100 border border-saffron-500 p-3 text-sm">
          💬 {t.cases.consentReminder}
        </p>
        <fieldset className="space-y-1">
          <legend className="font-medium">
            {t.cases.consent} <span className="text-red-700 dark:text-red-300">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {CONSENT_VALUES.map((v) => (
              <label key={v} className={`btn ${consent === v ? "btn-primary" : "btn-ghost"}`}>
                <input type="radio" name="consent" className="sr-only" checked={consent === v} onChange={() => setConsent(v)} required />
                {t.cases.consentValue[v]}
              </label>
            ))}
          </div>
          {consent === "no" && <p className="text-sm text-red-700 dark:text-red-300">⚠️ {t.cases.consentNoWarning}</p>}
        </fieldset>
        <TextInput label={t.cases.displayName} help={t.cases.displayNameHelp} value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
        <TextInput label={`${t.common.phone} (${t.common.optional})`} help={t.cases.phoneHelp} type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
        <TextInput label={t.common.area} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} />
        <fieldset>
          <legend className="font-medium mb-1">{t.cases.categories}</legend>
          <div className="flex flex-wrap gap-2">
            {CASE_CATEGORIES.map((c) => (
              <label key={c} className={`badge cursor-pointer min-h-[40px] px-3 ${cats.includes(c) ? "bg-teal-100 border-teal-600 text-teal-800" : ""}`}>
                <input type="checkbox" className="sr-only" checked={cats.includes(c)} onChange={() => toggleCat(c)} />
                {cats.includes(c) ? "✓ " : ""}
                {t.cases.category[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <Select
          label={t.common.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as Case["status"])}
          options={CASE_STATUSES.map((s) => ({ value: s, label: t.cases.statusLabel[s] }))}
        />
        <Select
          label={t.cases.assignedTo}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={[{ value: "", label: t.cases.unassigned }, ...volunteers.map((v) => ({ value: v.id, label: v.name }))]}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !consent}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const STATUS_STYLE: Record<Case["status"], string> = {
  new: "border-saffron-500 text-saffron-700 dark:text-saffron-100",
  active: "border-teal-600 text-teal-800 dark:text-teal-100",
  referred: "border-blue-500 text-blue-800 dark:text-blue-200",
  closed: "border-[var(--border)] muted",
};

/** Status always shown with a text label, never colour alone. */
export function CaseStatusBadge({ status }: { status: Case["status"] }) {
  const { t } = useUiPrefs();
  return <span className={`badge ${STATUS_STYLE[status]}`}>{t.cases.statusLabel[status]}</span>;
}
