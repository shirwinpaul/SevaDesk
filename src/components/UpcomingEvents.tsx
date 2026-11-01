"use client";

import Link from "next/link";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { dateInZone } from "@/lib/tasks";
import { EventSchema } from "@/types/models";

export function UpcomingEvents() {
  const { t } = useUiPrefs();
  const { items } = useCollection("events", EventSchema);
  const today = dateInZone(new Date());
  const upcoming = items.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  return (
    <section className="card" aria-labelledby="upcoming-events">
      <h2 id="upcoming-events" className="text-lg font-semibold mb-2">
        🙋 {t.home.upcomingEvents}
      </h2>
      {upcoming.length === 0 ? (
        <p className="muted">{t.home.noEvents}</p>
      ) : (
        <ul>
          {upcoming.map((e) => (
            <li key={e.id} className="border-b border-[var(--border)] last:border-b-0">
              <Link href={`/events/${e.id}`} className="flex justify-between gap-2 py-2 min-h-[48px] items-center hover:underline">
                <span className="font-medium">{e.title}</span>
                <span className="muted text-sm">📅 {e.date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
