"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { EmptyState, Modal, PageHeader, Spinner, TextArea, TextInput, Toggle } from "@/components/ui";
import { dateInZone } from "@/lib/tasks";
import { waLink } from "@/lib/whatsapp";
import { totalHours } from "@/lib/volunteers";
import { SKILLS, TIME_SLOTS, VolunteerSchema, type Skill, type TimeSlot, type Volunteer } from "@/types/models";


function Chips<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  label,
}: {
  legend: string;
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  label: (o: T) => string;
}) {
  return (
    <fieldset>
      <legend className="font-medium mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label key={String(o)} className={`badge cursor-pointer min-h-[40px] px-3 ${on ? "bg-teal-100 border-teal-600 text-teal-800" : ""}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
              {on ? "✓ " : ""}
              {label(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function VolunteerForm({ existing, onClose }: { existing?: Volunteer; onClose: () => void }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("volunteers", VolunteerSchema);
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [area, setArea] = useState(existing?.area ?? "");
  const [skills, setSkills] = useState<Skill[]>(existing?.skills ?? []);
  const [languages, setLanguages] = useState((existing?.languages ?? []).join(", "));
  const [days, setDays] = useState<number[]>(existing?.availableDays ?? []);
  const [slots, setSlots] = useState<TimeSlot[]>(existing?.availableSlots ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await save({
      ...(existing ?? { id: newId(), createdAt: new Date().toISOString(), hoursLog: [] }),
      name: name.trim(),
      phone: phone.trim(),
      area: area.trim(),
      skills,
      languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
      availableDays: [...days].sort(),
      availableSlots: slots,
      notes,
      active,
    });
    onClose();
  }

  return (
    <Modal open title={existing ? t.volunteers.edit : t.volunteers.add} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextInput label={t.common.name} value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
        <TextInput label={t.common.phone} type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
        <TextInput label={t.common.area} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} />
        <Chips legend={t.volunteers.skills} options={SKILLS} value={skills} onChange={setSkills} label={(s) => t.volunteers.skill[s]} />
        <TextInput label={t.volunteers.languages} value={languages} maxLength={120} onChange={(e) => setLanguages(e.target.value)} />
        <Chips legend={t.volunteers.availability} options={[0, 1, 2, 3, 4, 5, 6] as const} value={days} onChange={setDays} label={(d) => t.volunteers.days[d] ?? ""} />
        <Chips legend={t.events.slot} options={TIME_SLOTS} value={slots} onChange={setSlots} label={(s) => t.volunteers.slots[s]} />
        <TextArea label={t.common.notes} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        <Toggle label={t.volunteers.active} checked={active} onChange={setActive} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HoursForm({ v, onClose }: { v: Volunteer; onClose: () => void }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("volunteers", VolunteerSchema);
  const [date, setDate] = useState(dateInZone(new Date()));
  const [hours, setHours] = useState(2);
  const [note, setNote] = useState("");
  return (
    <Modal open title={`${t.volunteers.logHours} · ${v.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await save({ ...v, hoursLog: [...v.hoursLog, { id: newId(), date, hours, eventId: "", note }] });
          onClose();
        }}
      >
        <TextInput label={t.common.date} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        <TextInput label={t.volunteers.hours} type="number" min={0.25} max={24} step={0.25} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        <TextInput label={t.common.notes} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <ul className="text-sm muted max-h-40 overflow-y-auto">
          {[...v.hoursLog].reverse().map((h) => (
            <li key={h.id}>
              {h.date} · {h.hours} h {h.note && `· ${h.note}`}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function VolunteersPage() {
  const { t } = useUiPrefs();
  const { items, loading, remove } = useCollection("volunteers", VolunteerSchema);
  const [editing, setEditing] = useState<Volunteer | "new" | null>(null);
  const [hoursFor, setHoursFor] = useState<Volunteer | null>(null);
  const sorted = [...items].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.volunteers.title}
        icon="🤝"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            + {t.volunteers.add}
          </button>
        }
      />
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : sorted.length === 0 ? (
        <EmptyState text={t.volunteers.empty} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sorted.map((v) => (
            <li key={v.id} className={`card space-y-2 ${v.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-lg">{v.name}</p>
                  <p className="text-sm muted">
                    {v.area && `📍 ${v.area} · `}⏱️ {totalHours(v)} h{v.languages.length ? ` · 🗣️ ${v.languages.join(", ")}` : ""}
                  </p>
                </div>
                {!v.active && <span className="badge">—</span>}
              </div>
              <p className="flex flex-wrap gap-1">
                {v.skills.map((s) => (
                  <span key={s} className="badge">
                    {t.volunteers.skill[s]}
                  </span>
                ))}
              </p>
              <p className="text-sm">
                📅 {v.availableDays.map((d) => t.volunteers.days[d]).join(" ")} · {v.availableSlots.map((s) => t.volunteers.slots[s]).join(", ")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(v)}>
                  ✏️ {t.common.edit}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setHoursFor(v)}>
                  ⏱️ {t.volunteers.logHours}
                </button>
                {v.phone && (
                  <>
                    <a className="btn btn-ghost" href={`tel:${v.phone.replace(/\s/g, "")}`}>
                      📞 {t.volunteers.call}
                    </a>
                    <a className="btn btn-ghost" href={waLink("", v.phone)} target="_blank" rel="noopener noreferrer">
                      💬 {t.volunteers.whatsapp}
                    </a>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label={`${t.common.delete} ${v.name}`}
                  onClick={() => window.confirm(t.common.confirmDelete) && void remove(v.id)}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <VolunteerForm existing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {hoursFor && <HoursForm v={hoursFor} onClose={() => setHoursFor(null)} />}
    </div>
  );
}
