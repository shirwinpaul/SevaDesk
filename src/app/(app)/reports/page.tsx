"use client";

import { useMemo, useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { Dashboard } from "@/components/reports/Dashboard";
import { ImpactCard } from "@/components/reports/ImpactCard";
import { PressNote } from "@/components/reports/PressNote";
import { ReportGenerator } from "@/components/reports/ReportGenerator";
import { SocialPosts } from "@/components/reports/SocialPosts";
import { useImpactData } from "@/components/reports/shared";
import { PageHeader, Select, Spinner, TextInput } from "@/components/ui";
import { periodFor, type PeriodKind } from "@/lib/reports/metrics";
import { dateInZone } from "@/lib/tasks";

type Tab = "dashboard" | "report" | "press" | "social" | "card";

export default function ReportsPage() {
  const { t } = useUiPrefs();
  const data = useImpactData();
  // Children of the vault gate render only on the client, so reading the URL here is safe.
  const [campFromUrl] = useState(() => new URLSearchParams(window.location.search).get("camp") ?? "");
  const [tab, setTab] = useState<Tab>(campFromUrl ? "report" : "dashboard");
  const [kind, setKind] = useState<PeriodKind>("month");
  const [ref, setRef] = useState(dateInZone(new Date()));
  const period = useMemo(() => periodFor(kind, ref), [kind, ref]);
  const tabs: Tab[] = ["dashboard", "report", "press", "social", "card"];

  return (
    <div className="space-y-4">
      <PageHeader title={t.reports.title} icon="📰" />
      <div role="tablist" aria-label={t.reports.title} className="flex flex-wrap gap-2 no-print">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`btn ${tab === x ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(x)}>
            {t.reports.tabs[x]}
          </button>
        ))}
      </div>
      {(tab === "dashboard" || tab === "report" || tab === "card") && (
        <div className="card grid gap-3 sm:grid-cols-3 no-print">
          <Select
            label={t.reports.period}
            value={kind}
            onChange={(e) => setKind(e.target.value as PeriodKind)}
            options={(["month", "quarter", "year"] as const).map((k) => ({ value: k, label: t.reports.periodKind[k] }))}
          />
          <TextInput label={t.reports.refDate} type="date" value={ref} onChange={(e) => e.target.value && setRef(e.target.value)} />
          <p className="self-end pb-3 font-semibold">
            📅 {period.label} ({period.from} → {period.to})
          </p>
        </div>
      )}
      {data.loading ? (
        <Spinner label={t.common.loading} />
      ) : (
        <section role="tabpanel">
          {tab === "dashboard" && <Dashboard data={data} period={period} />}
          {tab === "report" && <ReportGenerator data={data} period={period} initialCampId={campFromUrl} />}
          {tab === "press" && <PressNote data={data} initialCampId={campFromUrl} />}
          {tab === "social" && <SocialPosts data={data} />}
          {tab === "card" && <ImpactCard data={data} period={period} />}
        </section>
      )}
    </div>
  );
}
