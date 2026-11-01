"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { formatINR } from "@/lib/camps";
import { computeImpact, monthlySeries, type ImpactData, type Period } from "@/lib/reports/metrics";
import { CASE_CATEGORIES } from "@/types/models";
import { Stat } from "../ui";

export function Dashboard({ data, period }: { data: ImpactData; period: Period }) {
  const { t } = useUiPrefs();
  const m = useMemo(() => computeImpact(data, period), [data, period]);
  const series = useMemo(() => monthlySeries(data, period.to, 12), [data, period.to]);
  const cats = CASE_CATEGORIES.filter((c) => m.reachByCategory[c]).map((c) => ({ name: t.cases.category[c], people: m.reachByCategory[c] ?? 0 }));

  const stats: Array<[keyof typeof t.reports.metric, string | number]> = [
    ["casesOpened", m.casesOpened],
    ["casesClosed", m.casesClosed],
    ["followUpsDone", m.followUpsDone],
    ["peopleReached", m.peopleReached],
    ["campsHeld", m.campsHeld],
    ["volunteerHours", m.volunteerHours],
    ["donationsCash", `₹${formatINR(m.donationsCash)}`],
    ["donationsInKind", m.donationsInKind],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map(([k, v]) => (
          <Stat key={k} label={t.reports.metric[k]} value={v} />
        ))}
      </div>

      <section className="card space-y-2">
        <h3 className="font-semibold">📈 {t.reports.trend}</h3>
        <div className="h-64" role="img" aria-label={t.reports.trend}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="casesOpened" name={t.reports.metric.casesOpened} stroke="#1f7a70" strokeWidth={2} />
              <Line type="monotone" dataKey="casesClosed" name={t.reports.metric.casesClosed} stroke="#3f7d2c" strokeWidth={2} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="followUpsDone" name={t.reports.metric.followUpsDone} stroke="#e8891c" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2">
          <h3 className="font-semibold">{t.reports.byCategory}</h3>
          {cats.length === 0 ? (
            <p className="muted">{t.reports.noData}</p>
          ) : (
            <div className="h-64" role="img" aria-label={t.reports.byCategory}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cats} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="people" name={t.reports.metric.peopleReached} fill="#1f7a70" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="card space-y-2">
          <h3 className="font-semibold">📍 {t.reports.byArea}</h3>
          {m.byArea.length === 0 ? (
            <p className="muted">{t.reports.noData}</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm muted">
                  <th className="p-1">{t.common.area}</th>
                  <th className="p-1">{t.reports.areaCases}</th>
                  <th className="p-1">{t.reports.areaPeople}</th>
                </tr>
              </thead>
              <tbody>
                {m.byArea.map((a) => (
                  <tr key={a.area} className="border-t border-[var(--border)]">
                    <td className="p-1">{a.area}</td>
                    <td className="p-1">{a.cases}</td>
                    <td className="p-1">{a.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
