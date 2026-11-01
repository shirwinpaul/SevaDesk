"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { CaseForm, CaseStatusBadge } from "@/components/CaseForm";
import { EmptyState, PageHeader, Select, Spinner, Stat } from "@/components/ui";
import { CASE_CATEGORIES, CASE_STATUSES, caseLabel, CaseSchema, TaskSchema, VolunteerSchema } from "@/types/models";

export default function CasesPage() {
  const { t } = useUiPrefs();
  const { items: cases, loading } = useCollection("cases", CaseSchema);
  const { items: tasks } = useCollection("tasks", TaskSchema);
  const { items: volunteers } = useCollection("volunteers", VolunteerSchema);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [area, setArea] = useState("");
  const [owner, setOwner] = useState("");
  // Children of the vault gate render only on the client, so reading the URL here is safe.
  const [formOpen, setFormOpen] = useState(() => new URLSearchParams(window.location.search).has("new"));

  const areas = useMemo(() => [...new Set(cases.map((c) => c.area).filter(Boolean))].sort(), [cases]);
  const volunteerName = (vid: string) => volunteers.find((v) => v.id === vid)?.name ?? "";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases
      .filter(
        (c) =>
          (!needle || [c.displayName, caseLabel(c.number), c.area].some((s) => s.toLowerCase().includes(needle))) &&
          (!cat || c.categories.includes(cat as (typeof CASE_CATEGORIES)[number])) &&
          (!status || c.status === status) &&
          (!area || c.area === area) &&
          (!owner || c.assignedTo === owner),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [cases, q, cat, status, area, owner]);

  const openTasks = (cid: string) => tasks.filter((x) => x.caseId === cid && x.status === "open").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.cases.title}
        icon="📁"
        actions={
          <>
            <Link href="/tasks" className="btn btn-ghost">
              ✅ {t.tasks.title}
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              + {t.cases.newCase}
            </button>
          </>
        }
      />

      <section aria-label={t.cases.countsTitle} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CASE_STATUSES.map((s) => (
          <Stat key={s} label={t.cases.statusLabel[s]} value={cases.filter((c) => c.status === s).length} />
        ))}
      </section>

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="case-search" className="block font-medium">
            {t.common.search}
          </label>
          <input id="case-search" className="field" type="search" placeholder={t.cases.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select
          label={t.cases.filterCategory}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          options={[{ value: "", label: t.common.all }, ...CASE_CATEGORIES.map((c) => ({ value: c, label: t.cases.category[c] }))]}
        />
        <Select
          label={t.cases.filterStatus}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[{ value: "", label: t.common.all }, ...CASE_STATUSES.map((s) => ({ value: s, label: t.cases.statusLabel[s] }))]}
        />
        <Select label={t.cases.filterArea} value={area} onChange={(e) => setArea(e.target.value)} options={[{ value: "", label: t.common.all }, ...areas.map((a) => ({ value: a, label: a }))]} />
        <Select
          label={t.cases.filterOwner}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          options={[{ value: "", label: t.common.all }, ...volunteers.map((v) => ({ value: v.id, label: v.name }))]}
        />
      </div>

      {loading ? (
        <Spinner label={t.common.loading} />
      ) : filtered.length === 0 ? (
        <EmptyState text={cases.length ? t.common.emptyList : t.cases.noCases} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link href={`/cases/${c.id}`} className="card block hover:border-teal-600 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm muted">{caseLabel(c.number)}</span>
                  <CaseStatusBadge status={c.status} />
                </div>
                <p className="font-semibold text-lg">{c.displayName}</p>
                <p className="text-sm muted flex flex-wrap gap-x-3">
                  {c.area && <span>📍 {c.area}</span>}
                  {c.assignedTo && <span>👤 {volunteerName(c.assignedTo)}</span>}
                  <span>
                    ✅ {openTasks(c.id)} {t.cases.tasks.toLowerCase()}
                  </span>
                </p>
                {c.categories.length > 0 && (
                  <p className="flex flex-wrap gap-1 pt-1">
                    {c.categories.map((x) => (
                      <span key={x} className="badge">
                        {t.cases.category[x]}
                      </span>
                    ))}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {formOpen && <CaseForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}
