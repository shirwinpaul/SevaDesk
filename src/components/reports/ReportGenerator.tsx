"use client";

import { useMemo, useState } from "react";
import type { ReportKind } from "@/data/reports";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { maskContext } from "@/lib/ai/client";
import { formatINR } from "@/lib/camps";
import { mask } from "@/lib/mask";
import { budgetTable, checkNumbers, eventFacts, periodFacts, reportToText, templateReport, type Facts } from "@/lib/reports/generate";
import { computeImpact, type ImpactData, type Period } from "@/lib/reports/metrics";
import { AiButton } from "../AiButton";
import { copyText, printScoped, Select, TextArea } from "../ui";
import { HighlightedText, ValidationBanner } from "./shared";

const KINDS: ReportKind[] = ["monthly", "quarterly", "annual", "event", "donorThanks", "grantOutline"];

export function ReportGenerator({ data, period, initialCampId = "" }: { data: ImpactData; period: Period; initialCampId?: string }) {
  const { t, prefs } = useUiPrefs();
  const { settings } = useSettings();
  const [kind, setKind] = useState<ReportKind>(initialCampId ? "event" : "monthly");
  const [lang, setLang] = useState<"en" | "ta" | "both">(prefs.lang);
  const [tone, setTone] = useState<"formal" | "warm" | "newsy">("warm");
  const [campId, setCampId] = useState(initialCampId);
  const [highlights, setHighlights] = useState("");
  const [text, setText] = useState("");

  const completed = data.camps.filter((c) => c.afterEvent).sort((a, b) => b.date.localeCompare(a.date));
  const camp = completed.find((c) => c.id === campId);
  const metrics = useMemo(() => computeImpact(data, period), [data, period]);
  const org = settings.orgName || "Our organisation";

  const facts: Facts = kind === "event" ? (camp ? eventFacts(camp) : {}) : periodFacts(metrics);

  const validation = text ? checkNumbers(text, facts, [highlights, period.label, period.from, period.to, org, camp?.afterEvent?.highlights ?? ""]) : null;
  const budget = kind === "grantOutline" ? budgetTable(data.camps.filter((c) => c.date >= period.from && c.date <= period.to)) : [];
  const periodText = kind === "event" ? camp?.date ?? "" : period.label;
  const needsCamp = kind === "event" && !camp;

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <Select label={t.reports.kind} value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} options={KINDS.map((k) => ({ value: k, label: t.reports.kinds[k] }))} />
        <Select
          label={t.reports.language}
          value={lang}
          onChange={(e) => setLang(e.target.value as "en" | "ta" | "both")}
          options={[
            { value: "en", label: "English" },
            { value: "ta", label: "தமிழ்" },
            { value: "both", label: t.reports.both },
          ]}
        />
        <Select label={t.reports.tone} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} options={(["formal", "warm", "newsy"] as const).map((x) => ({ value: x, label: t.reports.tones[x] }))} />
        {kind === "event" && (
          <Select
            label={t.reports.event}
            value={campId}
            onChange={(e) => setCampId(e.target.value)}
            options={[{ value: "", label: t.reports.chooseEvent }, ...completed.map((c) => ({ value: c.id, label: `${c.date} · ${c.title}` }))]}
          />
        )}
      </div>
      {kind === "event" && completed.length === 0 && <p className="muted">{t.reports.noCompleted}</p>}

      <section className="card space-y-2 no-print">
        <h3 className="font-semibold">🔢 {t.reports.factsTitle}</h3>
        <ul className="grid gap-x-4 sm:grid-cols-2 text-sm">
          {Object.entries(facts).map(([k, v]) => (
            <li key={k}>
              {(t.reports.metric as Record<string, string>)[k] ?? k}: <strong>{typeof v === "number" && k === "donationsCash" ? `₹${formatINR(v)}` : v}</strong>
            </li>
          ))}
        </ul>
        <TextArea label={t.reports.highlights} value={highlights} maxLength={2000} onChange={(e) => setHighlights(e.target.value)} />
        <div className="flex flex-wrap gap-2 items-start">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={needsCamp}
            onClick={() => setText(reportToText(templateReport(kind, lang, { ...facts, org, period: periodText, highlights: highlights || camp?.afterEvent?.highlights || "" })))}
          >
            {t.reports.useTemplate}
          </button>
          <AiButton
            task="report"
            module="reports"
            label={t.reports.aiWrite}
            disabled={needsCamp}
            prepare={(extraTerms) => {
              const ctx = maskContext({ cases: data.cases, volunteers: data.volunteers, extraTerms });
              const { masked, map } = mask(highlights || camp?.afterEvent?.highlights || "", ctx);
              return { input: { kind, lang, tone, org, period: periodText, facts, highlights: masked }, map };
            }}
            onResult={(doc) => setText(reportToText(doc))}
          />
        </div>
      </section>

      {text && (
        <section className="space-y-3">
          <ValidationBanner result={validation} />
          <TextArea label={t.reports.tabs.report} rows={14} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2 no-print">
            <button type="button" className="btn btn-primary" onClick={printScoped}>
              {t.reports.printPdf}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void copyText(text)}>
              {t.reports.copyText}
            </button>
          </div>
          <p className="text-xs muted">{t.ai.disclaimer}</p>
          <article className="print-target card space-y-3" lang={lang === "ta" ? "ta" : lang === "en" ? "en" : undefined}>
            <HighlightedText text={text} flagged={validation?.unverifiedNumbers ?? []} />
            {budget.length > 0 && (
              <>
                <h3 className="font-semibold">{t.reports.budgetTable}</h3>
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-1">{t.camps.item}</th>
                      <th className="p-1">{t.camps.planned}</th>
                      <th className="p-1">{t.camps.actual}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.map((b) => (
                      <tr key={b.item} className="border-t border-[var(--border)]">
                        <td className="p-1">{b.item}</td>
                        <td className="p-1">₹{formatINR(b.planned)}</td>
                        <td className="p-1">₹{formatINR(b.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
