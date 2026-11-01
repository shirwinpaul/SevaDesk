"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { CAMP_TEMPLATES, templateById } from "@/data/camps";
import { EmptyState, Modal, PageHeader, Spinner, TextInput } from "@/components/ui";
import { addDays, dateInZone } from "@/lib/tasks";
import { CampSchema } from "@/types/models";

function NewCamp({ onClose }: { onClose: () => void }) {
  const { t, prefs } = useUiPrefs();
  const router = useRouter();
  const { save } = useCollection("camps", CampSchema);
  const [templateId, setTemplateId] = useState("");
  const tpl = templateById(templateId);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(dateInZone(new Date()), 30));
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [expected, setExpected] = useState(100);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    const camp = await save({
      id: newId(),
      templateId: tpl.id,
      title: title.trim() || tpl.name[prefs.lang],
      date,
      location,
      area,
      expectedBeneficiaries: expected,
      checklist: tpl.checklist.map((c) => ({ id: newId(), stage: c.stage, text: c[prefs.lang], done: false, permission: !!c.permission })),
      supplies: tpl.supplies.map((s) => ({ id: newId(), ...s, override: null })),
      schedule: tpl.schedule.map((s) => ({ id: newId(), ...s, owner: "" })),
      createdAt: new Date().toISOString(),
    });
    onClose();
    router.push(`/camps/${camp.id}`);
  }

  return (
    <Modal open title={t.camps.newCamp} onClose={onClose}>
      {!tpl ? (
        <>
          <p className="font-medium">{t.camps.chooseTemplate}</p>
          <ul className="grid grid-cols-2 gap-2">
            {CAMP_TEMPLATES.map((x) => (
              <li key={x.id}>
                <button type="button" className="card w-full h-full text-left hover:border-teal-600" onClick={() => setTemplateId(x.id)}>
                  <span aria-hidden="true" className="text-2xl block">
                    {x.icon}
                  </span>
                  <span className="font-medium">{x.name[prefs.lang]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form onSubmit={create} className="space-y-3">
          <p className="text-lg">
            {tpl.icon} {tpl.name[prefs.lang]}
          </p>
          <TextInput label={t.camps.campTitle} placeholder={tpl.name[prefs.lang]} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <TextInput label={t.common.date} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          <TextInput label={t.events.location} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />
          <TextInput label={t.common.area} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} />
          <TextInput label={t.camps.expected} type="number" min={0} value={expected} onChange={(e) => setExpected(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
          <div className="flex justify-between gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setTemplateId("")}>
              ← {t.common.back}
            </button>
            <button type="submit" className="btn btn-primary">
              {t.common.save}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function CampsPage() {
  const { t, prefs } = useUiPrefs();
  const { items, loading } = useCollection("camps", CampSchema);
  const [open, setOpen] = useState(false);
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.camps.title}
        icon="⛺"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            + {t.camps.newCamp}
          </button>
        }
      />
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : sorted.length === 0 ? (
        <EmptyState text={t.camps.empty} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sorted.map((c) => {
            const tpl = templateById(c.templateId);
            const done = c.checklist.filter((x) => x.done).length;
            return (
              <li key={c.id}>
                <Link href={`/camps/${c.id}`} className="card block hover:border-teal-600 space-y-1">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-lg">
                      {tpl?.icon} {c.title}
                    </p>
                    <span className={`badge ${c.afterEvent ? "border-leaf-600 text-leaf-700 dark:text-leaf-100" : "border-saffron-500"}`}>
                      {c.afterEvent ? t.camps.completed : t.camps.planning}
                    </span>
                  </div>
                  <p className="text-sm muted">
                    📅 {c.date} {c.location && `· 📍 ${c.location}`}
                  </p>
                  <p className="text-sm">
                    ✅ {done}/{c.checklist.length} · {tpl?.name[prefs.lang]}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {open && <NewCamp onClose={() => setOpen(false)} />}
    </div>
  );
}
