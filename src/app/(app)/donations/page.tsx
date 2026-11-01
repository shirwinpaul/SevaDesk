"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useSettings } from "@/hooks/useVault";
import { copyText, EmptyState, Modal, PageHeader, Select, Spinner, Stat, TextArea, TextInput, Toggle, printScoped } from "@/components/ui";
import { formatINR } from "@/lib/camps";
import { dateInZone } from "@/lib/tasks";
import { CampSchema, DonationSchema, type Donation } from "@/types/models";

function letterText(d: Donation, org: string, lang: "en" | "ta"): string {
  const name = d.anonymous || !d.donor ? (lang === "ta" ? "அன்புள்ள நண்பரே" : "Dear friend") : lang === "ta" ? `அன்புள்ள ${d.donor}` : `Dear ${d.donor}`;
  const gift = d.type === "cash" ? `₹${formatINR(d.amount)}` : d.items || (lang === "ta" ? "உங்கள் பொருள் நன்கொடை" : "your in-kind gift");
  return lang === "ta"
    ? `${name},\n\n${d.date} அன்று நீங்கள் அளித்த ${gift} நன்கொடைக்கு எங்கள் மனமார்ந்த நன்றி${d.purpose ? ` (${d.purpose})` : ""}. உங்கள் ஆதரவு எங்கள் சமூகப் பணிக்கு பெரும் பலமாக உள்ளது.\n\nஅன்புடன்,\n${org}`
    : `${name},\n\nThank you so much for your gift of ${gift} on ${d.date}${d.purpose ? ` towards ${d.purpose}` : ""}. Your support makes a real difference to the people we serve.\n\nWith warm regards,\n${org}`;
}

function DonationForm({ onClose }: { onClose: () => void }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("donations", DonationSchema);
  const { items: camps } = useCollection("camps", CampSchema);
  const [f, setF] = useState({ date: dateInZone(new Date()), donor: "", anonymous: false, type: "cash" as Donation["type"], amount: 0, items: "", purpose: "", campId: "" });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Modal open title={t.donations.add} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await save({ id: newId(), ...f, donor: f.anonymous ? "" : f.donor.trim(), createdAt: new Date().toISOString() });
          onClose();
        }}
      >
        <TextInput label={t.common.date} type="date" value={f.date} required onChange={(e) => set({ date: e.target.value })} />
        <Toggle label={t.donations.anonymous} checked={f.anonymous} onChange={(v) => set({ anonymous: v })} />
        {!f.anonymous && <TextInput label={t.donations.donor} value={f.donor} maxLength={120} onChange={(e) => set({ donor: e.target.value })} />}
        <Select
          label={t.donations.type}
          value={f.type}
          onChange={(e) => set({ type: e.target.value === "inKind" ? "inKind" : "cash" })}
          options={[
            { value: "cash", label: t.donations.cash },
            { value: "inKind", label: t.donations.inKind },
          ]}
        />
        {f.type === "cash" ? (
          <TextInput label={t.donations.amount} type="number" min={0} step="0.01" value={f.amount} onChange={(e) => set({ amount: Math.max(0, Number(e.target.value) || 0) })} />
        ) : (
          <TextInput label={t.donations.items} value={f.items} maxLength={300} onChange={(e) => set({ items: e.target.value })} />
        )}
        <TextInput label={t.donations.purpose} value={f.purpose} maxLength={300} onChange={(e) => set({ purpose: e.target.value })} />
        <Select
          label={t.donations.linkedCamp}
          value={f.campId}
          onChange={(e) => set({ campId: e.target.value })}
          options={[{ value: "", label: t.media.none }, ...camps.map((c) => ({ value: c.id, label: `${c.date} · ${c.title}` }))]}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function DonationsPage() {
  const { t, prefs } = useUiPrefs();
  const { settings } = useSettings();
  const { items, loading, remove } = useCollection("donations", DonationSchema);
  const [open, setOpen] = useState(false);
  const [letterFor, setLetterFor] = useState<Donation | null>(null);
  const [letterLang, setLetterLang] = useState<"en" | "ta">(prefs.lang);
  const [letter, setLetter] = useState("");
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const totalCash = items.filter((d) => d.type === "cash").reduce((s, d) => s + d.amount, 0);
  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of items) if (d.type === "cash") m.set(d.date.slice(0, 7), (m.get(d.date.slice(0, 7)) ?? 0) + d.amount);
    return [...m.entries()].sort().slice(-12).map(([month, amount]) => ({ month, amount }));
  }, [items]);
  const org = settings.orgName || "SevaDesk";

  const openLetter = (d: Donation, lang = letterLang) => {
    setLetterFor(d);
    setLetter(letterText(d, org, lang));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.donations.title}
        icon="💰"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            + {t.donations.add}
          </button>
        }
      />
      <p className="rounded-xl border border-saffron-500 p-3 text-sm">ℹ️ {t.donations.disclaimer}</p>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t.donations.totalCash} value={`₹${formatINR(totalCash)}`} />
        <Stat label={t.donations.inKindCount} value={items.filter((d) => d.type === "inKind").length} />
        <Stat label={t.donations.donorsCount} value={items.length} />
      </div>
      {byMonth.length > 0 && (
        <div className="card h-64" role="img" aria-label={t.donations.byMonth}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(v) => `₹${formatINR(Number(v))}`} />
              <Bar dataKey="amount" name={t.donations.amount} fill="#3f7d2c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : sorted.length === 0 ? (
        <EmptyState text={t.donations.empty} />
      ) : (
        <ul className="space-y-2">
          {sorted.map((d) => (
            <li key={d.id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {d.type === "cash" ? `₹${formatINR(d.amount)}` : `🎁 ${d.items || t.donations.inKind}`} · {d.anonymous || !d.donor ? t.donations.anonymous : d.donor}
                </p>
                <p className="text-sm muted">
                  📅 {d.date} {d.purpose && `· ${d.purpose}`}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => openLetter(d)}>
                {t.donations.thankYou}
              </button>
              <button type="button" className="btn btn-ghost" aria-label={t.common.delete} onClick={() => window.confirm(t.common.confirmDelete) && void remove(d.id)}>
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <DonationForm onClose={() => setOpen(false)} />}
      <Modal open={!!letterFor} title={t.donations.letterTitle} onClose={() => setLetterFor(null)}>
        <Select
          label={t.donations.letterLang}
          value={letterLang}
          onChange={(e) => {
            const l = e.target.value === "ta" ? "ta" : "en";
            setLetterLang(l);
            if (letterFor) openLetter(letterFor, l);
          }}
          options={[
            { value: "en", label: "English" },
            { value: "ta", label: "தமிழ்" },
          ]}
        />
        <TextArea label={t.donations.letterTitle} rows={10} value={letter} onChange={(e) => setLetter(e.target.value)} />
        <p className="text-sm muted">ℹ️ {t.donations.noReceipt}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => void copyText(letter)}>
            📋 {t.common.copy}
          </button>
          <button type="button" className="btn btn-primary" onClick={printScoped}>
            🖨️ {t.common.print}
          </button>
        </div>
        <div className="print-target print-target-hidden whitespace-pre-wrap text-lg p-8" lang={letterLang}>
          {letter}
        </div>
      </Modal>
    </div>
  );
}
