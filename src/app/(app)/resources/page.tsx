"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useVault } from "@/hooks/useVault";
import { Modal, PageHeader, Select, Spinner, TextArea, TextInput, Toggle } from "@/components/ui";
import { EXAMPLE_HELPLINES } from "@/data/helplines";
import { waLink } from "@/lib/whatsapp";
import { RESOURCE_CATEGORIES, ResourceSchema, type Resource } from "@/types/models";

type Cat = (typeof RESOURCE_CATEGORIES)[number];

function ResourceForm({ existing, onClose }: { existing?: Resource; onClose: () => void }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("resources", ResourceSchema);
  const [f, setF] = useState({
    name: existing?.name ?? "",
    category: existing?.category ?? ("hospital" as Cat),
    area: existing?.area ?? "",
    phone: existing?.phone ?? "",
    hours: existing?.hours ?? "",
    notes: existing?.notes ?? "",
    emergency: existing?.emergency ?? false,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal open title={existing ? t.resources.edit : t.resources.add} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.name.trim()) return;
          await save({
            ...(existing ?? { id: newId(), createdAt: new Date().toISOString(), needsVerification: false }),
            ...f,
            name: f.name.trim(),
            // Editing the phone number of an example means the user is taking responsibility for it.
            needsVerification: existing ? existing.needsVerification && existing.phone === f.phone : false,
          });
          onClose();
        }}
      >
        <TextInput label={t.common.name} value={f.name} required maxLength={120} onChange={(e) => set({ name: e.target.value })} />
        <Select label={t.resources.category} value={f.category} onChange={(e) => set({ category: e.target.value as Cat })} options={RESOURCE_CATEGORIES.map((c) => ({ value: c, label: t.resources.categories[c] }))} />
        <TextInput label={t.common.area} value={f.area} maxLength={80} onChange={(e) => set({ area: e.target.value })} />
        <TextInput label={t.common.phone} type="tel" value={f.phone} maxLength={30} onChange={(e) => set({ phone: e.target.value })} />
        <TextInput label={t.resources.hours} value={f.hours} maxLength={80} onChange={(e) => set({ hours: e.target.value })} />
        <TextArea label={t.common.notes} value={f.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
        <Toggle label={t.resources.emergency} checked={f.emergency} onChange={(v) => set({ emergency: v })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!f.name.trim()}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ResourcesPage() {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const { items, loading, save, remove } = useCollection("resources", ResourceSchema);
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const shown = items
    .filter((r) => (!cat || r.category === cat) && (!q || `${r.name} ${r.area}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.name.localeCompare(b.name));

  async function addExamples() {
    for (const h of EXAMPLE_HELPLINES) {
      if (items.some((r) => r.phone === h.phone)) continue;
      await session.save("resources", ResourceSchema, { id: newId(), ...h, needsVerification: true, createdAt: new Date().toISOString() });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.resources.title}
        icon="📚"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            + {t.resources.add}
          </button>
        }
      />
      {(items.length === 0 || items.every((r) => r.needsVerification)) && (
        <section className="card space-y-2 border-teal-600">
          <h2 className="text-lg font-semibold">🌱 {t.resources.guideTitle}</h2>
          <ol className="list-decimal pl-5 space-y-1">
            {t.resources.guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
          <button type="button" className="btn btn-ghost" onClick={addExamples}>
            {t.resources.addExamples}
          </button>
        </section>
      )}
      <div className="card grid gap-3 sm:grid-cols-2">
        <TextInput label={t.common.search} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label={t.resources.filterCategory} value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "", label: t.common.all }, ...RESOURCE_CATEGORIES.map((c) => ({ value: c, label: t.resources.categories[c] }))]} />
      </div>
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : shown.length === 0 ? (
        <p className="muted">{t.resources.empty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-lg flex-1">{r.name}</p>
                <span className="badge">{t.resources.categories[r.category]}</span>
                {r.emergency && <span className="badge border-red-400 text-red-800 dark:text-red-200">🚑 SOS</span>}
              </div>
              <p className="text-sm muted">
                {r.area && `📍 ${r.area} · `}
                {r.phone && `📞 ${r.phone}`} {r.hours && `· 🕘 ${r.hours}`}
              </p>
              {r.notes && <p className="text-sm">{r.notes}</p>}
              {r.needsVerification && (
                <div className="rounded-xl border-2 border-saffron-500 p-2 space-y-1">
                  <p className="text-sm font-bold text-saffron-700 dark:text-saffron-100">⚠️ {t.resources.verifyWarning}</p>
                  <button type="button" className="btn btn-ghost" onClick={() => void save({ ...r, needsVerification: false })}>
                    ✓ {t.resources.markVerified}
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {r.phone && (
                  <>
                    <a className="btn btn-primary" href={`tel:${r.phone.replace(/\s/g, "")}`}>
                      📞 {t.resources.call}
                    </a>
                    {r.phone.replace(/\D/g, "").length >= 10 && (
                      <a className="btn btn-ghost" href={waLink("", r.phone)} target="_blank" rel="noopener noreferrer">
                        💬 {t.resources.whatsapp}
                      </a>
                    )}
                  </>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(r)}>
                  ✏️ {t.common.edit}
                </button>
                <button type="button" className="btn btn-ghost" aria-label={`${t.common.delete} ${r.name}`} onClick={() => window.confirm(t.common.confirmDelete) && void remove(r.id)}>
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <ResourceForm existing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
