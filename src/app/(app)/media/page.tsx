"use client";

import { useMemo, useRef, useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useSettings, useVault } from "@/hooks/useVault";
import { EmptyState, LiveMessage, Modal, PageHeader, Select, Spinner, Stat, TextInput, Toggle, printScoped } from "@/components/ui";
import { mediaCounts, mediaFromCsv } from "@/lib/media";
import { dateInZone } from "@/lib/tasks";
import { CampSchema, MEDIA_TYPES, MediaItemSchema, type MediaItem, type MediaType } from "@/types/models";

/** Shrink a photo to max 1200px JPEG so it fits comfortably in an encrypted record. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < 650_000) return url;
  }
  throw new Error("too big");
}

function MediaForm({ existing, onClose }: { existing?: MediaItem; onClose: () => void }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("media", MediaItemSchema);
  const { items: camps } = useCollection("camps", CampSchema);
  const [f, setF] = useState({
    outlet: existing?.outlet ?? "",
    type: existing?.type ?? ("print" as MediaType),
    language: existing?.language ?? "",
    date: existing?.date ?? dateInZone(new Date()),
    headline: existing?.headline ?? "",
    link: existing?.link ?? "",
    tags: (existing?.tags ?? []).join(", "),
    campId: existing?.campId ?? "",
    featured: existing?.featured ?? false,
    clipping: existing?.clipping ?? "",
  });
  const [err, setErr] = useState("");
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const linkOk = !f.link || /^https?:\/\//.test(f.link);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.outlet.trim() || !f.headline.trim() || !linkOk) return;
    await save({
      ...(existing ?? { id: newId(), createdAt: new Date().toISOString() }),
      ...f,
      outlet: f.outlet.trim(),
      headline: f.headline.trim(),
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  }

  return (
    <Modal open title={existing ? t.media.edit : t.media.add} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextInput label={t.media.outlet} value={f.outlet} required maxLength={120} onChange={(e) => set({ outlet: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t.media.type} value={f.type} onChange={(e) => set({ type: e.target.value as MediaType })} options={MEDIA_TYPES.map((x) => ({ value: x, label: t.media.types[x] }))} />
          <TextInput label={t.media.language} value={f.language} maxLength={30} onChange={(e) => set({ language: e.target.value })} />
        </div>
        <TextInput label={t.common.date} type="date" value={f.date} required onChange={(e) => set({ date: e.target.value })} />
        <TextInput label={t.media.headline} value={f.headline} required maxLength={300} onChange={(e) => set({ headline: e.target.value })} />
        <TextInput label={t.media.link} type="url" value={f.link} maxLength={1000} onChange={(e) => set({ link: e.target.value })} />
        <TextInput label={t.media.tags} value={f.tags} maxLength={200} onChange={(e) => set({ tags: e.target.value })} />
        <Select
          label={t.media.relatedCamp}
          value={f.campId}
          onChange={(e) => set({ campId: e.target.value })}
          options={[{ value: "", label: t.media.none }, ...camps.map((c) => ({ value: c.id, label: `${c.date} · ${c.title}` }))]}
        />
        <div className="space-y-1">
          <label className="block font-medium" htmlFor="clip">
            {t.media.clipping}
          </label>
          <input
            id="clip"
            type="file"
            accept="image/*"
            className="field"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                set({ clipping: await compressImage(file) });
                setErr("");
              } catch {
                setErr(t.common.error);
              }
            }}
          />
          {f.clipping && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local encrypted data URL */}
              <img src={f.clipping} alt={f.headline} className="h-24 rounded-lg border border-[var(--border)]" />
              <button type="button" className="btn btn-ghost" onClick={() => set({ clipping: "" })}>
                {t.media.removeClipping}
              </button>
            </div>
          )}
        </div>
        <Toggle label={t.media.featured} checked={f.featured} onChange={(v) => set({ featured: v })} />
        <LiveMessage message={err} tone="error" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!f.outlet.trim() || !f.headline.trim() || !linkOk}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CountTable({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="text-sm">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-[var(--border)] py-1">
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function MediaPage() {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const { settings } = useSettings();
  const { items, loading, remove } = useCollection("media", MediaItemSchema);
  const [editing, setEditing] = useState<MediaItem | "new" | null>(null);
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" }>({ text: "", tone: "success" });
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => items.filter((m) => (!year || m.date.startsWith(year)) && (!type || m.type === type)).sort((a, b) => b.date.localeCompare(a.date)),
    [items, year, type],
  );
  const counts = useMemo(() => mediaCounts(filtered), [filtered]);
  const years = [...new Set(items.map((m) => m.date.slice(0, 4)))].sort().reverse();
  const typeLabel = (k: string) => t.media.types[k as MediaType] ?? k;

  async function importCsv(file: File) {
    const { items: rows, errors } = mediaFromCsv(await file.text(), newId);
    for (const r of rows) await session.save("media", MediaItemSchema, r);
    setMsg({
      text: [fmt(t.media.imported, { n: rows.length }), errors.length ? fmt(t.media.importErrors, { list: errors.map((e) => `${e.line} (${e.reason})`).join("; ") }) : ""].filter(Boolean).join(" "),
      tone: errors.length ? "error" : "success",
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.media.title}
        icon="🗞️"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              ⬆️ {t.media.importCsv}
            </button>
            <button type="button" className="btn btn-ghost" onClick={printScoped} disabled={!filtered.length}>
              {t.media.printSummary}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              + {t.media.add}
            </button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={t.media.importCsv}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importCsv(f);
          e.target.value = "";
        }}
      />
      <p className="text-sm muted no-print">{t.media.csvHelp}</p>
      <LiveMessage message={msg.text} tone={msg.tone} />

      <div className="card grid gap-3 sm:grid-cols-2 no-print">
        <Select label={t.media.filterYear} value={year} onChange={(e) => setYear(e.target.value)} options={[{ value: "", label: t.common.all }, ...years.map((y) => ({ value: y, label: y }))]} />
        <Select label={t.media.filterType} value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "", label: t.common.all }, ...MEDIA_TYPES.map((x) => ({ value: x, label: t.media.types[x] }))]} />
      </div>

      {loading ? (
        <Spinner label={t.common.loading} />
      ) : items.length === 0 ? (
        <EmptyState text={t.media.empty} />
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2 no-print" aria-label={t.media.counts}>
            <Stat label={t.media.total} value={counts.total} />
            <Stat label={t.media.featured} value={counts.featured} />
            <Stat label={t.media.byOutlet} value={Object.keys(counts.byOutlet).length} />
            <Stat label={t.media.byLanguage} value={Object.keys(counts.byLanguage).length} />
          </section>

          <section aria-label={t.media.timeline} className="no-print">
            <h2 className="text-lg font-semibold mb-2">🕘 {t.media.timeline}</h2>
            <ol className="relative border-l-4 border-teal-600 ml-2 space-y-4">
              {filtered.map((m) => (
                <li key={m.id} className="ml-4">
                  <div className="card space-y-1">
                    <p className="text-sm muted">
                      📅 {m.date} · {m.outlet} · {typeLabel(m.type)} {m.language && `· ${m.language}`} {m.featured && "· ⭐"}
                    </p>
                    <p className="font-semibold">{m.headline}</p>
                    {m.tags.length > 0 && (
                      <p className="flex flex-wrap gap-1">
                        {m.tags.map((x) => (
                          <span key={x} className="badge">
                            #{x}
                          </span>
                        ))}
                      </p>
                    )}
                    {m.clipping && (
                      // eslint-disable-next-line @next/next/no-img-element -- local encrypted data URL
                      <img src={m.clipping} alt={m.headline} className="max-h-48 rounded-lg border border-[var(--border)]" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {m.link && (
                        <a className="btn btn-ghost" href={m.link} target="_blank" rel="noopener noreferrer">
                          🔗 Link
                        </a>
                      )}
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(m)}>
                        ✏️ {t.common.edit}
                      </button>
                      <button type="button" className="btn btn-ghost" aria-label={`${t.common.delete} ${m.headline}`} onClick={() => window.confirm(t.common.confirmDelete) && void remove(m.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
            <CountTable title={t.media.byYear} counts={counts.byYear} />
            <CountTable title={t.media.byOutlet} counts={counts.byOutlet} />
            <CountTable title={t.media.byLanguage} counts={counts.byLanguage} />
            <CountTable title={t.media.byType} counts={Object.fromEntries(Object.entries(counts.byType).map(([k, v]) => [typeLabel(k), v]))} />
          </section>
        </>
      )}

      <article className="print-target print-target-hidden space-y-4">
        <h1 className="text-3xl font-bold">{t.media.summaryTitle}</h1>
        <p>
          {settings.orgName} · {t.media.total}: <strong>{counts.total}</strong>
          {year && ` · ${year}`}
        </p>
        <div className="grid grid-cols-2 gap-6">
          <CountTable title={t.media.byYear} counts={counts.byYear} />
          <CountTable title={t.media.byOutlet} counts={counts.byOutlet} />
          <CountTable title={t.media.byLanguage} counts={counts.byLanguage} />
          <CountTable title={t.media.byType} counts={Object.fromEntries(Object.entries(counts.byType).map(([k, v]) => [typeLabel(k), v]))} />
        </div>
        {filtered.some((m) => m.featured) && (
          <>
            <h2 className="text-xl font-semibold">{t.media.featured}</h2>
            <ul>
              {filtered.filter((m) => m.featured).map((m) => (
                <li key={m.id}>
                  {m.date} — <strong>{m.outlet}</strong>: {m.headline}
                </li>
              ))}
            </ul>
          </>
        )}
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-1">{t.common.date}</th>
              <th className="p-1">{t.media.outlet}</th>
              <th className="p-1">{t.media.type}</th>
              <th className="p-1">{t.media.headline}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-1 whitespace-nowrap">{m.date}</td>
                <td className="p-1">{m.outlet}</td>
                <td className="p-1">{typeLabel(m.type)}</td>
                <td className="p-1">{m.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {editing && <MediaForm existing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
