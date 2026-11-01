"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection, useSettings } from "@/hooks/useVault";
import { EventForm } from "@/components/EventForm";
import { ThankYouAiButton } from "@/components/ThankYouAi";
import { EmptyState, LiveMessage, PageHeader, Select, Spinner, TextArea, TextInput, printScoped } from "@/components/ui";
import { autoAssign, checkManualAssignment, shiftHours } from "@/lib/assign";
import { callForVolunteersMessage, mapLink, reminderMessage, shiftConfirmationMessage, waLink } from "@/lib/whatsapp";
import { EventSchema, SKILLS, TIME_SLOTS, VolunteerSchema, type Assignment, type Shift, type Skill, type SevaEvent, type TimeSlot, type Volunteer } from "@/types/models";

function ShiftAdder({ onAdd }: { onAdd: (s: Shift) => void }) {
  const { t } = useUiPrefs();
  const [role, setRole] = useState("");
  const [slot, setSlot] = useState<TimeSlot>("morning");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [required, setRequired] = useState(1);
  const [skills, setSkills] = useState<Skill[]>([]);
  return (
    <form
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 items-end border-t border-[var(--border)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!role.trim() || start >= end) return;
        onAdd({ id: newId(), role: role.trim(), slot, start, end, required, requiredSkills: skills });
        setRole("");
        setSkills([]);
      }}
    >
      <TextInput label={t.events.role} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} />
      <Select label={t.events.slot} value={slot} onChange={(e) => setSlot(e.target.value as TimeSlot)} options={TIME_SLOTS.map((s) => ({ value: s, label: t.volunteers.slots[s] }))} />
      <TextInput label={t.events.required} type="number" min={1} max={100} value={required} onChange={(e) => setRequired(Math.max(1, Number(e.target.value) || 1))} />
      <TextInput label={t.events.start} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
      <TextInput label={t.events.end} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      <Select
        label={t.events.requiredSkills}
        value={skills[0] ?? ""}
        onChange={(e) => setSkills(e.target.value ? [e.target.value as Skill] : [])}
        options={[{ value: "", label: t.common.none }, ...SKILLS.map((s) => ({ value: s, label: t.volunteers.skill[s] }))]}
      />
      <button type="submit" className="btn btn-ghost sm:col-span-2 lg:col-span-3" disabled={!role.trim()}>
        + {t.events.addShift}
      </button>
    </form>
  );
}

export default function EventDetailPage() {
  const { t, prefs } = useUiPrefs();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettings();
  const { items: events, loading, save, remove } = useCollection("events", EventSchema);
  const { items: volunteers, save: saveVolunteer } = useCollection("volunteers", VolunteerSchema);
  const [editOpen, setEditOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" | "success" }>({ text: "", tone: "info" });
  const [msgLang, setMsgLang] = useState<"en" | "ta">(prefs.lang);
  const [qr, setQr] = useState("");
  const [thanks, setThanks] = useState("");
  const [dragging, setDragging] = useState<Assignment | null>(null);

  const ev = events.find((e) => e.id === params.id);
  const mapHref = ev ? mapLink(ev) : "";

  useEffect(() => {
    if (!mapHref) return;
    QRCode.toDataURL(mapHref, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [mapHref]);

  const vById = useMemo(() => new Map(volunteers.map((v) => [v.id, v])), [volunteers]);

  if (loading) return <Spinner label={t.common.loading} />;
  if (!ev) return <EmptyState text={t.events.notFound}><Link href="/events" className="btn btn-ghost">{t.common.back}</Link></EmptyState>;

  const update = (patch: Partial<SevaEvent>) => save({ ...ev, ...patch });
  const ctx = { org: settings.orgName, event: ev };
  const assignedVolunteers = [...new Set(ev.assignments.map((a) => a.volunteerId))].map((id) => vById.get(id)).filter((v): v is Volunteer => !!v);
  const shiftsOf = (vid: string) => ev.assignments.filter((a) => a.volunteerId === vid).map((a) => ev.shifts.find((s) => s.id === a.shiftId)).filter((s): s is Shift => !!s);
  const unfilled = ev.shifts
    .map((s) => ({ ...s, missing: s.required - ev.assignments.filter((a) => a.shiftId === s.id).length }))
    .filter((s) => s.missing > 0);

  function runAutoAssign() {
    if (!ev) return;
    // Fairness across events: prior load = shifts held in other events.
    const priorLoad: Record<string, number> = {};
    const busy: Record<string, Array<{ start: string; end: string }>> = {};
    for (const other of events) {
      if (other.id === ev.id) continue;
      for (const a of other.assignments) {
        priorLoad[a.volunteerId] = (priorLoad[a.volunteerId] ?? 0) + 1;
        const s = other.shifts.find((x) => x.id === a.shiftId);
        if (s && other.date === ev.date) (busy[a.volunteerId] ??= []).push(s);
      }
    }
    const r = autoAssign({ date: ev.date, shifts: ev.shifts, volunteers, existing: ev.assignments, priorLoad, busy });
    void update({ assignments: r.assignments });
    setMsg(r.unfilled.length ? { text: `${t.events.unfilled}: ${r.unfilled.map((u) => `${u.role} (${u.missing})`).join(", ")}`, tone: "info" } : { text: t.events.allFilled, tone: "success" });
  }

  function move(a: Assignment, toShiftId: string) {
    if (!ev) return;
    const v = vById.get(a.volunteerId);
    const target = ev.shifts.find((s) => s.id === toShiftId);
    if (!v || !target || a.shiftId === toShiftId) return;
    const rest = ev.assignments.filter((x) => !(x.shiftId === a.shiftId && x.volunteerId === a.volunteerId));
    if (rest.some((x) => x.shiftId === toShiftId && x.volunteerId === v.id)) return;
    const problem = checkManualAssignment(v, target, ev.date, ev.shifts, rest);
    if (problem === "doubleBooked") {
      setMsg({ text: t.events.doubleBooked, tone: "error" });
      return;
    }
    if (problem === "notEligible") setMsg({ text: t.events.notEligible, tone: "info" });
    void update({ assignments: [...rest, { shiftId: toShiftId, volunteerId: v.id }] });
  }

  function addPerson(shiftId: string, vid: string) {
    if (!ev || !vid) return;
    const v = vById.get(vid);
    const target = ev.shifts.find((s) => s.id === shiftId);
    if (!v || !target || ev.assignments.some((a) => a.shiftId === shiftId && a.volunteerId === vid)) return;
    const problem = checkManualAssignment(v, target, ev.date, ev.shifts, ev.assignments);
    if (problem === "doubleBooked") {
      setMsg({ text: t.events.doubleBooked, tone: "error" });
      return;
    }
    if (problem === "notEligible") setMsg({ text: t.events.notEligible, tone: "info" });
    void update({ assignments: [...ev.assignments, { shiftId, volunteerId: vid }] });
  }

  async function logHours() {
    if (!ev || ev.hoursLogged) return;
    for (const v of assignedVolunteers) {
      const entries = shiftsOf(v.id).map((s) => ({ id: newId(), date: ev.date, hours: shiftHours(s), eventId: ev.id, note: `${ev.title} · ${s.role}` }));
      await saveVolunteer({ ...v, hoursLog: [...v.hoursLog, ...entries] });
    }
    await update({ hoursLogged: true });
    setMsg({ text: t.events.hoursLogged, tone: "success" });
  }

  const thankYou = thanks || t.events.defaultThanks;
  const eventHours = (vid: string) => shiftsOf(vid).reduce((s, x) => s + shiftHours(x), 0);

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/events" className="btn btn-ghost no-print">
        ← {t.events.title}
      </Link>
      <PageHeader
        title={ev.title}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(true)}>
              ✏️ {t.common.edit}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                if (!window.confirm(t.common.confirmDelete)) return;
                await remove(ev.id);
                router.push("/events");
              }}
            >
              🗑️ {t.common.delete}
            </button>
          </>
        }
      />
      <p className="muted">
        📅 {ev.date} · 📍 {ev.location || "—"}
      </p>
      {ev.description && <p className="whitespace-pre-wrap">{ev.description}</p>}
      <LiveMessage message={msg.text} tone={msg.tone} />

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">👥 {t.events.shifts}</h2>
          <button type="button" className="btn btn-accent" onClick={runAutoAssign} disabled={!ev.shifts.length || !volunteers.length}>
            {t.events.autoAssign}
          </button>
        </div>
        <p className="text-sm muted">{t.events.autoAssignHelp}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {ev.shifts.map((s) => {
            const here = ev.assignments.filter((a) => a.shiftId === s.id);
            const missing = s.required - here.length;
            return (
              <li
                key={s.id}
                className={`rounded-xl border p-3 space-y-2 ${missing > 0 ? "border-saffron-500" : "border-teal-600"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging) move(dragging, s.id);
                  setDragging(null);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.role}</p>
                    <p className="text-sm muted">
                      {t.volunteers.slots[s.slot]} · {s.start}–{s.end} · {here.length}/{s.required}
                      {s.requiredSkills.length > 0 && ` · ${s.requiredSkills.map((k) => t.volunteers.skill[k]).join(", ")}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`${t.common.delete} ${s.role}`}
                    onClick={() => void update({ shifts: ev.shifts.filter((x) => x.id !== s.id), assignments: ev.assignments.filter((a) => a.shiftId !== s.id) })}
                  >
                    🗑️
                  </button>
                </div>
                {missing > 0 && <p className="text-sm font-semibold text-saffron-700 dark:text-saffron-100">⚠️ {fmt(t.events.missing, { n: missing })}</p>}
                <ul className="space-y-1">
                  {here.map((a) => {
                    const v = vById.get(a.volunteerId);
                    return (
                      <li
                        key={a.volunteerId}
                        draggable
                        onDragStart={() => setDragging(a)}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-2)] px-2 py-1 cursor-grab"
                      >
                        <span className="flex-1 font-medium">☰ {v?.name ?? "?"}</span>
                        <label className="sr-only" htmlFor={`mv-${s.id}-${a.volunteerId}`}>
                          {t.events.moveTo}
                        </label>
                        <select id={`mv-${s.id}-${a.volunteerId}`} className="field w-auto min-h-[40px] py-1" value="" onChange={(e) => move(a, e.target.value)}>
                          <option value="">{t.events.moveTo}</option>
                          {ev.shifts.filter((x) => x.id !== s.id).map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.role} ({x.start})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost min-h-[40px] py-1"
                          onClick={() => void update({ assignments: ev.assignments.filter((x) => !(x.shiftId === s.id && x.volunteerId === a.volunteerId)) })}
                        >
                          {t.events.removeFromShift}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <label className="sr-only" htmlFor={`add-${s.id}`}>
                  {t.events.addPerson}
                </label>
                <select id={`add-${s.id}`} className="field" value="" onChange={(e) => addPerson(s.id, e.target.value)}>
                  <option value="">{t.events.addPerson}</option>
                  {volunteers.filter((v) => v.active && !here.some((a) => a.volunteerId === v.id)).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
        <ShiftAdder onAdd={(s) => void update({ shifts: [...ev.shifts, s] })} />
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">💬 {t.events.whatsappTools}</h2>
        <Select label={t.events.messageLang} value={msgLang} onChange={(e) => setMsgLang(e.target.value === "ta" ? "ta" : "en")} options={[{ value: "en", label: "English" }, { value: "ta", label: "தமிழ்" }]} />
        <div className="space-y-2">
          <h3 className="font-semibold">{t.events.callForVolunteers}</h3>
          <TextArea
            label={t.events.callForVolunteers}
            readOnly
            rows={6}
            value={callForVolunteersMessage(ctx, (unfilled.length ? unfilled : ev.shifts.map((s) => ({ ...s, missing: s.required }))).map((s) => ({ role: s.role, missing: s.missing, start: s.start, end: s.end })), msgLang)}
          />
          <a
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
            href={waLink(callForVolunteersMessage(ctx, (unfilled.length ? unfilled : ev.shifts.map((s) => ({ ...s, missing: s.required }))).map((s) => ({ role: s.role, missing: s.missing, start: s.start, end: s.end })), msgLang))}
          >
            💬 {t.events.openWhatsApp}
          </a>
        </div>
        {assignedVolunteers.length > 0 && (
          <ul className="space-y-2">
            {assignedVolunteers.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-2">
                <span className="flex-1 font-medium">{v.name}</span>
                <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={waLink(shiftConfirmationMessage(ctx, v.name, shiftsOf(v.id), msgLang), v.phone || undefined)}>
                  ✅ {t.events.confirmation}
                </a>
                <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={waLink(reminderMessage(ctx, v.name, shiftsOf(v.id), msgLang), v.phone || undefined)}>
                  ⏰ {t.events.reminder}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">🔳 {t.events.qr}</h2>
        <p className="text-sm muted">{t.events.qrHelp}</p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={qr} alt={`${t.events.qr}: ${mapHref}`} width={200} height={200} className="bg-white p-2 rounded-lg" />
        )}
        <a className="underline break-all text-sm" href={mapHref} target="_blank" rel="noopener noreferrer">
          {mapHref}
        </a>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">🏅 {t.events.certificates}</h2>
        <button type="button" className="btn btn-ghost" onClick={logHours} disabled={ev.hoursLogged || !assignedVolunteers.length}>
          ⏱️ {ev.hoursLogged ? t.events.hoursLogged : t.events.logHours}
        </button>
        <p className="text-sm muted">{t.events.certificatesHelp}</p>
        <TextArea label={t.events.thankYouLine} value={thankYou} maxLength={300} onChange={(e) => setThanks(e.target.value)} />
        <ThankYouAiButton eventTitle={ev.title} lang={msgLang} onResult={setThanks} />
        <button type="button" className="btn btn-primary" onClick={printScoped} disabled={!assignedVolunteers.length}>
          {t.events.printCertificates}
        </button>
        <div className="print-target print-target-hidden">
          {assignedVolunteers.map((v) => (
            <div key={v.id} className="certificate flex flex-col items-center justify-center text-center gap-6 border-8 border-double border-teal-700 p-12 text-black bg-white">
              <p className="text-xl">{settings.orgName}</p>
              <h2 className="text-4xl font-bold">{t.events.certificateTitle}</h2>
              <p className="text-3xl font-semibold">{v.name}</p>
              <p className="text-lg">
                {t.events.certificateBody} <strong>{ev.title}</strong> ({ev.date})
              </p>
              <p>{fmt(t.events.certificateHours, { n: eventHours(v.id) })}</p>
              <p className="italic max-w-xl">“{thankYou}”</p>
              <p className="mt-12 border-t border-black px-12 pt-2">{t.events.signature}</p>
            </div>
          ))}
        </div>
      </section>

      {editOpen && <EventForm existing={ev} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
