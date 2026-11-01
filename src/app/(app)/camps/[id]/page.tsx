"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useSettings } from "@/hooks/useVault";
import { templateById } from "@/data/camps";
import { EmptyState, LiveMessage, PageHeader, Select, Spinner, Stat, TextArea, TextInput, printScoped } from "@/components/ui";
import { budgetSummary, formatINR, stageDate, supplyTotals } from "@/lib/camps";
import {
  CampSchema,
  CASE_CATEGORIES,
  EventSchema,
  ResourceSchema,
  STAGES,
  VolunteerSchema,
  type AfterEvent,
  type Camp,
  type CaseCategory,
} from "@/types/models";

type Tab = "checklist" | "supplies" | "budget" | "runSheet" | "after";

/** Number input that tolerates empty text while typing. */
function Num({ value, onChange, label, min = 0, step = 1 }: { value: number; onChange: (n: number) => void; label: string; min?: number; step?: number }) {
  return (
    <input
      type="number"
      className="field min-w-0"
      aria-label={label}
      min={min}
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
    />
  );
}

export default function CampDetailPage() {
  const { t } = useUiPrefs();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettings();
  const { items: camps, loading, save, remove } = useCollection("camps", CampSchema);
  const { items: events, save: saveEvent } = useCollection("events", EventSchema);
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);
  const { items: resources } = useCollection("resources", ResourceSchema);
  const [tab, setTab] = useState<Tab>("checklist");
  const [msg, setMsg] = useState("");
  const [newCheck, setNewCheck] = useState("");
  const [afterDraft, setAfterDraft] = useState<Omit<AfterEvent, "completedAt"> | null>(null);

  const camp = camps.find((c) => c.id === params.id);
  if (loading) return <Spinner label={t.common.loading} />;
  if (!camp) return <EmptyState text={t.camps.notFound}><Link href="/camps" className="btn btn-ghost">{t.common.back}</Link></EmptyState>;

  const tpl = templateById(camp.templateId);
  const update = (patch: Partial<Camp>) => save({ ...camp, ...patch });
  const totals = supplyTotals(camp.supplies, camp.expectedBeneficiaries);
  const budget = budgetSummary(camp.budget, camp.sponsors);
  const linkedEvent = events.find((e) => e.id === camp.eventId);
  const eventVolunteers = linkedEvent ? [...new Set(linkedEvent.assignments.map((a) => a.volunteerId))].map((id) => volunteers.find((v) => v.id === id)).filter((v) => !!v) : [];
  const emergency = resources.filter((r) => r.emergency);
  const after = afterDraft ?? {
    peopleServed: camp.afterEvent?.peopleServed ?? 0,
    volunteers: camp.afterEvent?.volunteers ?? eventVolunteers.length,
    unitsCollected: camp.afterEvent?.unitsCollected ?? 0,
    itemsDistributed: camp.afterEvent?.itemsDistributed ?? 0,
    highlights: camp.afterEvent?.highlights ?? "",
    category: camp.afterEvent?.category ?? tpl?.category ?? "other",
  };

  async function createEvent() {
    if (!camp || !tpl) return;
    const ev = await saveEvent({
      id: newId(),
      title: camp.title,
      date: camp.date,
      location: camp.location,
      campId: camp.id,
      shifts: tpl.roles.map((r) => ({ id: newId(), role: r.role, slot: r.slot, start: r.start, end: r.end, required: r.required, requiredSkills: r.skills ?? [] })),
      createdAt: new Date().toISOString(),
    });
    await update({ eventId: ev.id });
    router.push(`/events/${ev.id}`);
  }

  const tabs: Tab[] = ["checklist", "supplies", "budget", "runSheet", "after"];

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/camps" className="btn btn-ghost no-print">
        ← {t.camps.title}
      </Link>
      <PageHeader
        title={`${tpl?.icon ?? ""} ${camp.title}`}
        actions={
          linkedEvent ? (
            <Link href={`/events/${linkedEvent.id}`} className="btn btn-ghost">
              🙋 {t.camps.openEvent}
            </Link>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={createEvent}>
              {t.camps.createEvent}
            </button>
          )
        }
      />
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <TextInput label={t.camps.campTitle} defaultValue={camp.title} maxLength={120} onBlur={(e) => e.target.value.trim() && void update({ title: e.target.value.trim() })} />
        <TextInput label={t.common.date} type="date" value={camp.date} onChange={(e) => e.target.value && void update({ date: e.target.value })} />
        <TextInput label={t.events.location} defaultValue={camp.location} maxLength={200} onBlur={(e) => void update({ location: e.target.value })} />
        <TextInput
          label={t.camps.expected}
          type="number"
          min={0}
          value={camp.expectedBeneficiaries}
          onChange={(e) => void update({ expectedBeneficiaries: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
      </div>

      <div role="tablist" aria-label={camp.title} className="flex flex-wrap gap-2 no-print">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`btn ${tab === x ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(x)}>
            {t.camps.tabs[x]}
          </button>
        ))}
      </div>
      <LiveMessage message={msg} tone="success" />

      {tab === "checklist" && (
        <section role="tabpanel" className="card space-y-4">
          <p className="text-sm rounded-xl border border-saffron-500 p-3">⚖️ {t.camps.permissionNote}</p>
          {STAGES.map((stage) => {
            const items = camp.checklist.filter((c) => c.stage === stage);
            if (!items.length) return null;
            return (
              <div key={stage}>
                <h3 className="font-semibold">
                  {t.camps.stage[stage]} <span className="muted text-sm">· {stageDate(camp.date, stage)}</span>
                </h3>
                <ul>
                  {items.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 min-h-[44px]">
                      <input
                        id={`ck-${c.id}`}
                        type="checkbox"
                        className="w-6 h-6 shrink-0 accent-teal-700"
                        checked={c.done}
                        onChange={() => void update({ checklist: camp.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
                      />
                      <label htmlFor={`ck-${c.id}`} className={c.done ? "line-through muted" : ""}>
                        {c.permission && "⚖️ "}
                        {c.text}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCheck.trim()) return;
              void update({ checklist: [...camp.checklist, { id: newId(), stage: "T-7", text: newCheck.trim(), done: false, permission: false }] });
              setNewCheck("");
            }}
          >
            <div className="flex-1">
              <TextInput label={t.camps.addItem} value={newCheck} maxLength={300} onChange={(e) => setNewCheck(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-ghost">
              {t.common.add}
            </button>
          </form>
        </section>
      )}

      {tab === "supplies" && (
        <section role="tabpanel" className="card space-y-3">
          <p className="text-sm muted">{t.camps.suppliesHelp}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="text-sm muted">
                  <th className="p-1">{t.camps.item}</th>
                  <th className="p-1">{t.camps.unit}</th>
                  <th className="p-1">{t.camps.perPerson}</th>
                  <th className="p-1">{t.camps.buffer}</th>
                  <th className="p-1">{t.camps.override}</th>
                  <th className="p-1">{t.camps.calculated}</th>
                  <th className="p-1" />
                </tr>
              </thead>
              <tbody>
                {camp.supplies.map((s, i) => {
                  const set = (patch: Partial<typeof s>) => void update({ supplies: camp.supplies.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) });
                  return (
                    <tr key={s.id} className="border-t border-[var(--border)]">
                      <td className="p-1">
                        <input className="field" aria-label={t.camps.item} defaultValue={s.item} maxLength={80} onBlur={(e) => e.target.value.trim() && set({ item: e.target.value.trim() })} />
                      </td>
                      <td className="p-1 w-24">
                        <input className="field" aria-label={t.camps.unit} defaultValue={s.unit} maxLength={20} onBlur={(e) => set({ unit: e.target.value })} />
                      </td>
                      <td className="p-1 w-24">
                        <Num label={t.camps.perPerson} value={s.perPerson} step={0.1} onChange={(n) => set({ perPerson: n })} />
                      </td>
                      <td className="p-1 w-20">
                        <Num label={t.camps.buffer} value={s.bufferPct} onChange={(n) => set({ bufferPct: Math.min(500, n) })} />
                      </td>
                      <td className="p-1 w-24">
                        <input
                          type="number"
                          className="field"
                          aria-label={t.camps.override}
                          min={0}
                          value={s.override ?? ""}
                          onChange={(e) => set({ override: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="p-1 font-bold">
                        {totals[i]?.total} {s.unit}
                        {totals[i]?.overridden && " ✋"}
                      </td>
                      <td className="p-1">
                        <button type="button" className="btn btn-ghost" aria-label={`${t.common.delete} ${s.item}`} onClick={() => void update({ supplies: camp.supplies.filter((x) => x.id !== s.id) })}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void update({ supplies: [...camp.supplies, { id: newId(), item: t.camps.item, unit: "", perPerson: 1, bufferPct: 10, override: null }] })}
          >
            + {t.camps.addItem}
          </button>
        </section>
      )}

      {tab === "budget" && (
        <section role="tabpanel" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label={t.camps.planned} value={`₹${formatINR(budget.planned)}`} />
            <Stat label={t.camps.actual} value={`₹${formatINR(budget.actual)}`} />
            <Stat label={t.camps.variance} value={`${budget.variance > 0 ? "+" : budget.variance < 0 ? "−" : ""}₹${formatINR(Math.abs(budget.variance))}`} />
            <Stat label={t.camps.netCost} value={`₹${formatINR(budget.netCost)}`} />
          </div>
          <div className="card space-y-2">
            {camp.budget.map((b) => {
              const set = (patch: Partial<typeof b>) => void update({ budget: camp.budget.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) });
              return (
                <div key={b.id} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_6rem_6rem_auto] gap-2 items-center">
                  <input className="field col-span-3 sm:col-span-1" aria-label={t.camps.item} defaultValue={b.item} maxLength={80} onBlur={(e) => e.target.value.trim() && set({ item: e.target.value.trim() })} />
                  <Num label={t.camps.planned} value={b.planned} onChange={(n) => set({ planned: n })} />
                  <Num label={t.camps.actual} value={b.actual} onChange={(n) => set({ actual: n })} />
                  <button type="button" className="btn btn-ghost" aria-label={`${t.common.delete} ${b.item}`} onClick={() => void update({ budget: camp.budget.filter((x) => x.id !== b.id) })}>
                    🗑️
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn btn-ghost" onClick={() => void update({ budget: [...camp.budget, { id: newId(), item: t.camps.item, planned: 0, actual: 0 }] })}>
              + {t.camps.addItem}
            </button>
          </div>
          {camp.budget.length > 0 && (
            <div className="card h-72" aria-label={`${t.camps.planned} / ${t.camps.actual}`} role="img">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={camp.budget.map((b) => ({ name: b.item, planned: b.planned, actual: b.actual }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planned" name={t.camps.planned} fill="#1f7a70" />
                  <Bar dataKey="actual" name={t.camps.actual} fill="#e8891c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="card space-y-2">
            <h3 className="font-semibold">🤝 {t.camps.sponsors}</h3>
            <p className="text-sm muted">
              {t.camps.inKindCount}: {budget.inKindCount}
            </p>
            {camp.sponsors.map((s) => {
              const set = (patch: Partial<typeof s>) => void update({ sponsors: camp.sponsors.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) });
              return (
                <div key={s.id} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_1fr_auto] items-center">
                  <input className="field" aria-label={t.camps.sponsorName} defaultValue={s.name} maxLength={120} onBlur={(e) => e.target.value.trim() && set({ name: e.target.value.trim() })} />
                  <select className="field" aria-label={t.camps.sponsorType} value={s.type} onChange={(e) => set({ type: e.target.value === "inKind" ? "inKind" : "cash" })}>
                    <option value="cash">{t.camps.cash}</option>
                    <option value="inKind">{t.camps.inKind}</option>
                  </select>
                  <Num label={t.camps.amount} value={s.amount} onChange={(n) => set({ amount: n })} />
                  <input className="field" aria-label={t.camps.description} defaultValue={s.description} maxLength={200} onBlur={(e) => set({ description: e.target.value })} />
                  <button type="button" className="btn btn-ghost" aria-label={`${t.common.delete} ${s.name}`} onClick={() => void update({ sponsors: camp.sponsors.filter((x) => x.id !== s.id) })}>
                    🗑️
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void update({ sponsors: [...camp.sponsors, { id: newId(), name: t.camps.sponsorName, type: "cash", amount: 0, description: "" }] })}
            >
              + {t.camps.addItem}
            </button>
          </div>
        </section>
      )}

      {tab === "runSheet" && (
        <section role="tabpanel" className="space-y-3">
          <div className="card space-y-2 no-print">
            {camp.schedule.map((s) => {
              const set = (patch: Partial<typeof s>) => void update({ schedule: camp.schedule.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) });
              return (
                <div key={s.id} className="grid grid-cols-[6rem_1fr_8rem_auto] gap-2 items-center">
                  <input type="time" className="field" aria-label={t.camps.time} value={s.time} onChange={(e) => set({ time: e.target.value })} />
                  <input className="field" aria-label={t.camps.activity} defaultValue={s.activity} maxLength={200} onBlur={(e) => set({ activity: e.target.value })} />
                  <input className="field" aria-label={t.camps.owner} defaultValue={s.owner} maxLength={80} onBlur={(e) => set({ owner: e.target.value })} />
                  <button type="button" className="btn btn-ghost" aria-label={t.common.delete} onClick={() => void update({ schedule: camp.schedule.filter((x) => x.id !== s.id) })}>
                    🗑️
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn btn-ghost" onClick={() => void update({ schedule: [...camp.schedule, { id: newId(), time: "09:00", activity: "", owner: "" }] })}>
              + {t.camps.addItem}
            </button>
          </div>
          <button type="button" className="btn btn-primary no-print" onClick={printScoped}>
            {t.camps.printRunSheet}
          </button>
          <div className="print-target card space-y-4">
            <h2 className="text-2xl font-bold">
              {camp.title} — {camp.date}
            </h2>
            <p>
              {settings.orgName} · 📍 {camp.location}
            </p>
            <h3 className="font-semibold text-lg">{t.camps.schedule}</h3>
            <table className="w-full text-left">
              <tbody>
                {[...camp.schedule].sort((a, b) => a.time.localeCompare(b.time)).map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="p-1 w-20 font-mono">{s.time}</td>
                    <td className="p-1">{s.activity}</td>
                    <td className="p-1">{s.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linkedEvent && (
              <>
                <h3 className="font-semibold text-lg">{t.camps.rolesTitle}</h3>
                <ul>
                  {linkedEvent.shifts.map((s) => (
                    <li key={s.id}>
                      <strong>{s.role}</strong> ({s.start}–{s.end}):{" "}
                      {linkedEvent.assignments
                        .filter((a) => a.shiftId === s.id)
                        .map((a) => volunteers.find((v) => v.id === a.volunteerId)?.name)
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </li>
                  ))}
                </ul>
                <h3 className="font-semibold text-lg">{t.camps.contacts}</h3>
                <ul>
                  {eventVolunteers.map((v) => (
                    <li key={v.id}>
                      {v.name} — {v.phone || "—"}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="font-semibold text-lg">🚑 {t.camps.emergency}</h3>
            {emergency.length === 0 ? (
              <p className="muted">{t.camps.noEmergency}</p>
            ) : (
              <ul>
                {emergency.map((r) => (
                  <li key={r.id}>
                    {r.name} — <strong>{r.phone}</strong> {r.hours && `(${r.hours})`} {r.needsVerification && "⚠️"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "after" && (
        <section role="tabpanel" className="card space-y-3">
          <h2 className="text-lg font-semibold">📊 {t.camps.afterTitle}</h2>
          <p className="text-sm muted">{t.camps.afterHelp}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["peopleServed", t.camps.peopleServed],
                ["volunteers", t.camps.volunteersCount],
                ["unitsCollected", t.camps.unitsCollected],
                ["itemsDistributed", t.camps.itemsDistributed],
              ] as const
            ).map(([k, label]) => (
              <TextInput key={k} label={label} type="number" min={0} value={after[k]} onChange={(e) => setAfterDraft({ ...after, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            ))}
          </div>
          <Select
            label={t.camps.reachCategory}
            value={after.category}
            onChange={(e) => setAfterDraft({ ...after, category: e.target.value as CaseCategory })}
            options={CASE_CATEGORIES.map((c) => ({ value: c, label: t.cases.category[c] }))}
          />
          <TextArea label={t.camps.highlights} value={after.highlights} maxLength={2000} onChange={(e) => setAfterDraft({ ...after, highlights: e.target.value })} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await update({ afterEvent: { ...after, completedAt: camp.afterEvent?.completedAt ?? new Date().toISOString() } });
              setAfterDraft(null);
              setMsg(t.common.saved);
            }}
          >
            {t.camps.saveAfter}
          </button>
          {camp.afterEvent && (
            <Link href={`/reports?camp=${camp.id}`} className="btn btn-ghost">
              📰 {t.home.writeReport}
            </Link>
          )}
        </section>
      )}

      <button
        type="button"
        className="btn btn-danger no-print"
        onClick={async () => {
          if (!window.confirm(t.common.confirmDelete)) return;
          await remove(camp.id);
          router.push("/camps");
        }}
      >
        🗑️ {t.camps.deleteCamp}
      </button>
    </div>
  );
}
