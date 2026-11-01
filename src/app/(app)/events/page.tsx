"use client";

import Link from "next/link";
import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { EventForm } from "@/components/EventForm";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { dateInZone } from "@/lib/tasks";
import { EventSchema, type SevaEvent } from "@/types/models";

function EventCard({ e }: { e: SevaEvent }) {
  const { t } = useUiPrefs();
  const needed = e.shifts.reduce((s, x) => s + x.required, 0);
  return (
    <li>
      <Link href={`/events/${e.id}`} className="card block hover:border-teal-600 space-y-1">
        <p className="font-semibold text-lg">{e.title}</p>
        <p className="text-sm muted">
          📅 {e.date} {e.location && `· 📍 ${e.location}`}
        </p>
        <p className="text-sm">
          🙋 {t.events.assigned}: {e.assignments.length}/{needed}
        </p>
      </Link>
    </li>
  );
}

export default function EventsPage() {
  const { t } = useUiPrefs();
  const { items, loading } = useCollection("events", EventSchema);
  const [open, setOpen] = useState(false);
  const today = dateInZone(new Date());
  const upcoming = items.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.events.title}
        icon="🙋"
        actions={
          <>
            <Link href="/volunteers" className="btn btn-ghost">
              🤝 {t.volunteers.title}
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              + {t.events.newEvent}
            </button>
          </>
        }
      />
      {loading ? (
        <Spinner label={t.common.loading} />
      ) : items.length === 0 ? (
        <EmptyState text={t.events.empty} />
      ) : (
        <>
          <h2 className="text-lg font-semibold">{t.events.upcoming}</h2>
          {upcoming.length ? <ul className="grid gap-3 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</ul> : <p className="muted">{t.home.noEvents}</p>}
          {past.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">{t.events.past}</h2>
              <ul className="grid gap-3 md:grid-cols-2">{past.map((e) => <EventCard key={e.id} e={e} />)}</ul>
            </>
          )}
        </>
      )}
      {open && <EventForm onClose={() => setOpen(false)} />}
    </div>
  );
}
