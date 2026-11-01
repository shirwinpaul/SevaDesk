"use client";

import { useMemo, useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { maskContext } from "@/lib/ai/client";
import { mask } from "@/lib/mask";
import { checkNumbers, eventFacts } from "@/lib/reports/generate";
import type { ImpactData } from "@/lib/reports/metrics";
import { waLink } from "@/lib/whatsapp";
import type { AiOutput } from "@/lib/ai/schemas";
import { AiButton } from "../AiButton";
import { copyText, printScoped, Select, TextArea, TextInput } from "../ui";
import { HighlightedText, ValidationBanner } from "./shared";

type Draft = AiOutput<"pressNote">;

/** Code-only press note (AI off). Numbers come straight from the after-event form. */
function templatePress(lang: "en" | "ta", f: ReturnType<typeof eventFacts>, org: string, dateline: string): Draft {
  return lang === "ta"
    ? {
        headline: `${f.eventTitle}: ${f.peopleServed} பேர் பயன்பெற்றனர்`,
        body: `${dateline}: ${org} சார்பில் ${f.eventTitle} நடைபெற்றது. இதில் ${f.peopleServed} பேர் பயன்பெற்றனர்; ${f.volunteers} தன்னார்வலர்கள் பங்கேற்றனர்.`,
        draftQuote: "",
      }
    : {
        headline: `${f.eventTitle} reaches ${f.peopleServed} people`,
        body: `${dateline}: ${org} organised ${f.eventTitle}. ${f.peopleServed} people were served with the help of ${f.volunteers} volunteers.`,
        draftQuote: "",
      };
}

function Version({ lang, draft, setDraft, quotes, contact, dateline, allowed }: { lang: "en" | "ta"; draft: Draft | null; setDraft: (d: Draft) => void; quotes: string; contact: string; dateline: string; allowed: { facts: Record<string, string | number>; user: string[] } }) {
  const { t } = useUiPrefs();
  const full = draft
    ? [draft.headline, "", `${draft.body}`, quotes && `\n${quotes}`, draft.draftQuote && `\n[${t.reports.draftQuoteLabel}]\n${draft.draftQuote}`, contact && `\n—\n${contact}`].filter(Boolean).join("\n")
    : "";
  const validation = useMemo(() => (draft ? checkNumbers(`${draft.headline}\n${draft.body}\n${draft.draftQuote}`, allowed.facts, [...allowed.user, dateline]) : null), [draft, allowed, dateline]);
  if (!draft) return null;
  return (
    <div className="card space-y-2" lang={lang}>
      <p className="badge">{lang === "ta" ? "தமிழ்" : "English"}</p>
      <ValidationBanner result={validation} />
      <TextInput label={t.reports.headline} value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
      <TextArea label={t.reports.tabs.press} rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
      {draft.draftQuote && (
        <div className="rounded-xl border-2 border-saffron-500 p-2">
          <p className="text-sm font-bold text-saffron-700 dark:text-saffron-100">⚠️ {t.reports.draftQuoteLabel}</p>
          <TextArea label={t.reports.draftQuoteLabel} value={draft.draftQuote} onChange={(e) => setDraft({ ...draft, draftQuote: e.target.value })} />
        </div>
      )}
      <div className="print-target-hidden print-target">
        <h2 className="text-2xl font-bold">{draft.headline}</h2>
        <HighlightedText text={full.split("\n").slice(2).join("\n")} flagged={validation?.unverifiedNumbers ?? []} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => void copyText(full)}>
          📋 {t.common.copy}
        </button>
        <a className="btn btn-ghost" href={waLink(full)} target="_blank" rel="noopener noreferrer">
          {t.reports.copyWhatsApp}
        </a>
        <a className="btn btn-ghost" href={`mailto:?subject=${encodeURIComponent(draft.headline)}&body=${encodeURIComponent(full)}`}>
          {t.reports.copyEmail}
        </a>
      </div>
    </div>
  );
}

export function PressNote({ data, initialCampId = "" }: { data: ImpactData; initialCampId?: string }) {
  const { t } = useUiPrefs();
  const { settings } = useSettings();
  const completed = data.camps.filter((c) => c.afterEvent).sort((a, b) => b.date.localeCompare(a.date));
  const [campId, setCampId] = useState(initialCampId || completed[0]?.id || "");
  const camp = completed.find((c) => c.id === campId);
  const [dateline, setDateline] = useState("");
  const [quotes, setQuotes] = useState("");
  const [contact, setContact] = useState("");
  const [en, setEn] = useState<Draft | null>(null);
  const [ta, setTa] = useState<Draft | null>(null);
  const org = settings.orgName || "Our organisation";

  if (!completed.length) return <p className="muted">{t.reports.noCompleted}</p>;
  const facts = camp ? eventFacts(camp) : null;
  const dl = dateline || (camp ? `${camp.location || camp.area}, ${camp.date}` : "");
  const allowed = { facts: facts ?? {}, user: [quotes, contact, camp?.afterEvent?.highlights ?? "", org] };

  const aiButton = (lang: "en" | "ta") =>
    facts && (
      <AiButton
        task="pressNote"
        module="reports"
        label={lang === "en" ? t.reports.generateEn : t.reports.generateTa}
        prepare={(extraTerms) => {
          const ctx = maskContext({ cases: data.cases, volunteers: data.volunteers, extraTerms });
          const { masked, map } = mask(camp?.afterEvent?.highlights ?? "", ctx);
          return { input: { lang, org, eventTitle: facts.eventTitle as string, dateline: dl, facts, highlights: masked }, map };
        }}
        onResult={(d) => (lang === "en" ? setEn(d) : setTa(d))}
      />
    );

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2 no-print">
        <Select label={t.reports.event} value={campId} onChange={(e) => setCampId(e.target.value)} options={completed.map((c) => ({ value: c.id, label: `${c.date} · ${c.title}` }))} />
        <TextInput label={t.reports.dateline} placeholder={dl} value={dateline} maxLength={80} onChange={(e) => setDateline(e.target.value)} />
        <TextArea label={t.reports.quotes} value={quotes} maxLength={1000} onChange={(e) => setQuotes(e.target.value)} />
        <TextArea label={t.reports.contact} value={contact} maxLength={300} onChange={(e) => setContact(e.target.value)} />
      </div>
      {facts && (
        <div className="flex flex-wrap gap-3 no-print">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setEn(templatePress("en", facts, org, dl));
              setTa(templatePress("ta", facts, org, dl));
            }}
          >
            {t.reports.useTemplate}
          </button>
          {aiButton("en")}
          {aiButton("ta")}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Version lang="en" draft={en} setDraft={setEn} quotes={quotes} contact={contact} dateline={dl} allowed={allowed} />
        <Version lang="ta" draft={ta} setDraft={setTa} quotes={quotes} contact={contact} dateline={dl} allowed={allowed} />
      </div>
      {(en || ta) && (
        <button type="button" className="btn btn-primary no-print" onClick={printScoped}>
          {t.reports.printPdf}
        </button>
      )}
    </div>
  );
}
