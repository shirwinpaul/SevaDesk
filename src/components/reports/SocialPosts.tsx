"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { maskContext } from "@/lib/ai/client";
import { mask } from "@/lib/mask";
import { checkNumbers, eventFacts } from "@/lib/reports/generate";
import type { ImpactData } from "@/lib/reports/metrics";
import { waLink } from "@/lib/whatsapp";
import type { AiOutput } from "@/lib/ai/schemas";
import { AiButton } from "../AiButton";
import { copyText, Select, TextArea, Toggle } from "../ui";
import { ValidationBanner } from "./shared";

type Posts = AiOutput<"socialPosts">;
const FIELDS: Array<[keyof Posts, string, number]> = [
  ["facebook", "Facebook", 1200],
  ["instagram", "Instagram", 1200],
  ["x", "X", 280],
  ["whatsappStatus", "WhatsApp status", 400],
];

export function SocialPosts({ data }: { data: ImpactData }) {
  const { t, prefs } = useUiPrefs();
  const { settings } = useSettings();
  const completed = data.camps.filter((c) => c.afterEvent).sort((a, b) => b.date.localeCompare(a.date));
  const [campId, setCampId] = useState(completed[0]?.id ?? "");
  const [lang, setLang] = useState<"en" | "ta">(prefs.lang);
  const [consent, setConsent] = useState(false);
  const [posts, setPosts] = useState<Posts | null>(null);
  const camp = completed.find((c) => c.id === campId);
  const org = settings.orgName || "";

  if (!completed.length) return <p className="muted">{t.reports.noCompleted}</p>;
  const facts = camp ? eventFacts(camp) : null;

  const template = (): Posts => {
    const f = facts!;
    const line =
      lang === "ta"
        ? `${f.eventTitle} 💚 ${f.peopleServed} பேர் பயன்பெற்றனர், ${f.volunteers} தன்னார்வலர்கள் பங்கேற்றனர். நன்றி! 🙏`
        : `${f.eventTitle} 💚 ${f.peopleServed} people served with ${f.volunteers} volunteers. Thank you! 🙏`;
    return { facebook: `${line}${org ? `\n— ${org}` : ""}`, instagram: `${line} #community #seva`, x: line.slice(0, 270), whatsappStatus: line };
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2 no-print">
        <Select label={t.reports.event} value={campId} onChange={(e) => setCampId(e.target.value)} options={completed.map((c) => ({ value: c.id, label: `${c.date} · ${c.title}` }))} />
        <Select label={t.reports.language} value={lang} onChange={(e) => setLang(e.target.value === "ta" ? "ta" : "en")} options={[{ value: "en", label: "English" }, { value: "ta", label: "தமிழ்" }]} />
      </div>
      <p className="text-sm rounded-xl border border-saffron-500 p-3">🛡️ {t.reports.consentNeeded}</p>
      <Toggle label={t.reports.consentTick} checked={consent} onChange={setConsent} />
      {facts && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setPosts(template())}>
            {t.reports.useTemplate}
          </button>
          <AiButton
            task="socialPosts"
            module="reports"
            label={t.reports.aiWrite}
            prepare={(extraTerms) => {
              // Beneficiary names are never sent: highlights are masked like everything else.
              const ctx = maskContext({ cases: data.cases, volunteers: data.volunteers, extraTerms });
              const { masked, map } = mask(camp?.afterEvent?.highlights ?? "", ctx);
              return { input: { lang, org, eventTitle: String(facts.eventTitle), facts, highlights: masked.slice(0, 1000) }, map };
            }}
            onResult={setPosts}
          />
        </div>
      )}
      {posts && (
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.map(([k, label, max]) => {
            const v = checkNumbers(posts[k], facts ?? {}, [camp?.afterEvent?.highlights ?? "", org]);
            return (
              <div key={k} className="card space-y-2" lang={lang}>
                <ValidationBanner result={v} />
                <TextArea label={`${label} (${posts[k].length}/${max})`} rows={5} maxLength={max} value={posts[k]} onChange={(e) => setPosts({ ...posts, [k]: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => void copyText(posts[k])}>
                    📋 {t.common.copy}
                  </button>
                  {k === "whatsappStatus" && (
                    <a className="btn btn-ghost" href={waLink(posts[k])} target="_blank" rel="noopener noreferrer">
                      {t.reports.copyWhatsApp}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
