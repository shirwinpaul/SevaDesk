"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { addDays, dateInZone } from "@/lib/tasks";
import { caseLabel, CaseSchema, TASK_PRIORITIES, TaskSchema, type Task } from "@/types/models";
import { Modal, Select, TextInput } from "./ui";

const PRIORITY_STYLE: Record<Task["priority"], string> = {
  high: "border-red-400 text-red-800 dark:text-red-200",
  normal: "border-teal-600 text-teal-800 dark:text-teal-100",
  low: "border-[var(--border)] muted",
};

export function TaskItem({
  task,
  caseNumber,
  hideDetails = false,
  overdue = false,
}: {
  task: Task;
  caseNumber?: number;
  hideDetails?: boolean;
  overdue?: boolean;
}) {
  const { t } = useUiPrefs();
  const { save } = useCollection("tasks", TaskSchema);
  const done = task.status === "done";
  const title = hideDetails ? `${t.tasks.task} · ${caseNumber ? caseLabel(caseNumber) : "—"}` : task.title;

  return (
    <li className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-b-0">
      <input
        type="checkbox"
        className="w-6 h-6 shrink-0 accent-teal-700"
        aria-label={done ? t.tasks.reopen : t.tasks.markDone}
        checked={done}
        onChange={() =>
          void save({ ...task, status: done ? "open" : "done", doneAt: done ? null : new Date().toISOString() })
        }
      />
      <div className="flex-1 min-w-0">
        <p className={`font-medium break-words ${done ? "line-through muted" : ""}`}>{title}</p>
        <p className="text-sm muted flex flex-wrap gap-x-3">
          <span className={overdue ? "text-red-700 dark:text-red-300 font-semibold" : ""}>
            {overdue ? `⚠️ ${t.tasks.overdue}: ` : "📅 "}
            {task.dueDate}
          </span>
          {!hideDetails && caseNumber && <span>📁 {caseLabel(caseNumber)}</span>}
          {!hideDetails && task.owner && <span>👤 {task.owner}</span>}
        </p>
      </div>
      <span className={`badge ${PRIORITY_STYLE[task.priority]}`}>{t.tasks.priorityValue[task.priority]}</span>
    </li>
  );
}

export function TaskForm({
  open,
  onClose,
  defaultCaseId = "",
  initial,
}: {
  open: boolean;
  onClose: () => void;
  defaultCaseId?: string;
  initial?: Partial<Pick<Task, "title" | "dueDate" | "owner">>;
}) {
  const { t } = useUiPrefs();
  const { save } = useCollection("tasks", TaskSchema);
  const { items: cases } = useCollection("cases", CaseSchema);
  const today = dateInZone(new Date());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? addDays(today, 3));
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [caseId, setCaseId] = useState(defaultCaseId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await save({ id: newId(), title: title.trim(), dueDate, priority, owner, caseId, createdAt: new Date().toISOString() });
    setTitle("");
    onClose();
  }

  return (
    <Modal open={open} title={t.tasks.newTask} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <TextInput label={t.tasks.task} value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        <TextInput label={t.tasks.dueDate} type="date" value={dueDate} required onChange={(e) => setDueDate(e.target.value)} />
        <Select
          label={t.tasks.priority}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task["priority"])}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: t.tasks.priorityValue[p] }))}
        />
        <TextInput label={t.tasks.owner} value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
        <Select
          label={t.tasks.linkedCase}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          options={[
            { value: "", label: t.tasks.noCase },
            ...[...cases].sort((a, b) => b.number - a.number).map((c) => ({ value: c.id, label: `${caseLabel(c.number)} · ${c.displayName}` })),
          ]}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
