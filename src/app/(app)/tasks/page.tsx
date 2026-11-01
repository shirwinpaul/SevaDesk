"use client";

import { useMemo, useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useCollection } from "@/hooks/useVault";
import { TaskForm, TaskItem } from "@/components/tasks";
import { downloadFile, LiveMessage, PageHeader, Spinner } from "@/components/ui";
import { bucketTasks, tasksToIcs } from "@/lib/tasks";
import { CaseSchema, TaskSchema } from "@/types/models";

type View = "today" | "week" | "overdue" | "later" | "done";

export default function TasksPage() {
  const { t } = useUiPrefs();
  const { items: tasks, loading } = useCollection("tasks", TaskSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  const [view, setView] = useState<View>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);
  const caseNumbers = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, c.number])), [cases]);
  const done = tasks.filter((x) => x.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const list = view === "done" ? done : buckets[view];

  const tabs: Array<{ id: View; label: string; count: number }> = [
    { id: "overdue", label: t.tasks.overdue, count: buckets.overdue.length },
    { id: "today", label: t.tasks.today, count: buckets.today.length },
    { id: "week", label: t.tasks.week, count: buckets.week.length },
    { id: "later", label: t.tasks.later, count: buckets.later.length },
    { id: "done", label: t.tasks.done, count: done.length },
  ];

  function exportIcs() {
    const ics = tasksToIcs(tasks, caseNumbers);
    if (!ics) {
      setMsg(t.tasks.empty);
      return;
    }
    downloadFile("sevadesk-followups.ics", ics, "text/calendar");
    setMsg(t.tasks.icsNote);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader
        title={t.tasks.title}
        icon="✅"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={exportIcs}>
              {t.tasks.exportIcs}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              + {t.tasks.newTask}
            </button>
          </>
        }
      />
      <p className="text-sm muted">{t.tasks.icsNote}</p>
      <LiveMessage message={msg} />
      <div role="tablist" aria-label={t.tasks.title} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={view === tab.id}
            className={`btn ${view === tab.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label} <span className="badge">{tab.count}</span>
          </button>
        ))}
      </div>
      <section role="tabpanel" className="card">
        {loading ? (
          <Spinner label={t.common.loading} />
        ) : list.length === 0 ? (
          <p className="muted">{t.tasks.empty}</p>
        ) : (
          <ul>
            {list.map((task) => (
              <TaskItem key={task.id} task={task} caseNumber={caseNumbers[task.caseId]} overdue={view === "overdue"} />
            ))}
          </ul>
        )}
      </section>
      {formOpen && <TaskForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}
