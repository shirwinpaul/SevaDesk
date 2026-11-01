"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection, useSettings } from "@/hooks/useVault";
import { TaskItem } from "@/components/tasks";
import { UpcomingEvents } from "@/components/UpcomingEvents";
import { CommunityIllustration } from "@/components/Illustrations";
import { Stat } from "@/components/ui";
import { bucketTasks } from "@/lib/tasks";
import { CaseSchema, TaskSchema } from "@/types/models";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function HomePage() {
  const { t } = useUiPrefs();
  const { settings } = useSettings();
  const { items: tasks } = useCollection("tasks", TaskSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);
  const caseNumbers = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c.number])), [cases]);
  const hide = settings.fieldMode;
  // eslint-disable-next-line react-hooks/purity -- reading the clock for a reminder is fine
  const now = Date.now();
  const backupDue =
    cases.length + tasks.length > 0 && (!settings.lastBackupAt || now - new Date(settings.lastBackupAt).getTime() > WEEK_MS);

  const actions = [
    { href: "/notes?new=1", icon: "🗒️", label: t.home.newNote },
    { href: "/cases?new=1", icon: "📁", label: t.home.newCase },
    { href: "/camps", icon: "⛺", label: t.home.planCamp },
    { href: "/reports", icon: "📰", label: t.home.writeReport },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {t.home.greeting}
            {settings.workerName && !hide ? `, ${settings.workerName}` : ""} 🌿
          </h1>
          {settings.orgName && <p className="muted">{settings.orgName}</p>}
        </div>
        <CommunityIllustration className="hidden sm:block w-48 h-auto" />
      </div>

      {hide && <p className="badge border-saffron-500 py-2">🕶️ {t.home.fieldModeOn}</p>}

      {backupDue && (
        <div className="card border-saffron-500 flex flex-wrap items-center justify-between gap-3">
          <p>💾 {t.backupReminder.due}</p>
          <Link href="/settings" className="btn btn-accent">
            {t.backupReminder.action}
          </Link>
        </div>
      )}

      <section aria-labelledby="qa">
        <h2 id="qa" className="sr-only">
          {t.home.quickActions}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="card flex flex-col items-center gap-1 py-4 hover:border-teal-600 font-semibold text-center">
              <span aria-hidden="true" className="text-2xl">
                {a.icon}
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label={t.cases.countsTitle}>
        <Stat label={t.home.openCases} value={cases.filter((c) => c.status !== "closed").length} />
        <Stat label={t.tasks.today} value={buckets.today.length} />
        <Stat label={t.tasks.overdue} value={buckets.overdue.length} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card" aria-labelledby="today">
          <h2 id="today" className="text-lg font-semibold mb-2">
            📅 {t.home.todayTasks}
          </h2>
          {buckets.today.length === 0 ? (
            <p className="muted">{t.home.nothingToday}</p>
          ) : (
            <ul>
              {buckets.today.map((task) => (
                <TaskItem key={task.id} task={task} caseNumber={caseNumbers[task.caseId]} hideDetails={hide} />
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="overdue">
          <h2 id="overdue" className="text-lg font-semibold mb-2">
            ⚠️ {t.home.overdue}
          </h2>
          {buckets.overdue.length === 0 ? (
            <p className="muted">{t.home.nothingOverdue}</p>
          ) : (
            <ul>
              {buckets.overdue.map((task) => (
                <TaskItem key={task.id} task={task} caseNumber={caseNumbers[task.caseId]} hideDetails={hide} overdue />
              ))}
            </ul>
          )}
        </section>
      </div>

      <UpcomingEvents />

      <Link href="/tasks" className="btn btn-ghost">
        {t.home.allTasks} →
      </Link>
    </div>
  );
}
