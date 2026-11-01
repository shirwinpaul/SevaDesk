"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { newId, useCollection } from "@/hooks/useVault";
import { addDays, dateInZone } from "@/lib/tasks";
import { TaskSchema } from "@/types/models";

interface Suggestion {
  task: string;
  suggestedDueInDays?: number;
  owner?: string;
}

/** Suggested follow-ups become tasks only when the user confirms each one. */
export function FollowUpSuggestions({ suggestions, caseId }: { suggestions: Suggestion[]; caseId: string }) {
  const { t } = useUiPrefs();
  const { save } = useCollection("tasks", TaskSchema);
  const [rows, setRows] = useState(() =>
    suggestions.map((s) => ({ task: s.task, days: s.suggestedDueInDays ?? 3, owner: s.owner ?? "", created: false })),
  );

  if (rows.length === 0) return null;

  async function create(i: number) {
    const r = rows[i];
    if (!r || !r.task.trim()) return;
    await save({
      id: newId(),
      title: r.task.trim(),
      caseId,
      dueDate: addDays(dateInZone(new Date()), r.days),
      owner: r.owner,
      createdAt: new Date().toISOString(),
    });
    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, created: true } : x)));
  }

  return (
    <section className="space-y-2" aria-labelledby="fu-title">
      <h3 id="fu-title" className="font-semibold">
        ✅ {t.notes.followUpsSuggested}
      </h3>
      <p className="text-sm muted">{t.notes.followUpsHelp}</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] items-end border-b border-[var(--border)] pb-2">
            <div>
              <label className="sr-only" htmlFor={`fu-${i}`}>
                {t.tasks.task}
              </label>
              <input
                id={`fu-${i}`}
                className="field"
                value={r.task}
                disabled={r.created}
                maxLength={200}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, task: e.target.value } : x)))}
              />
            </div>
            <div>
              <label className="text-xs muted" htmlFor={`fud-${i}`}>
                {t.notes.dueInDays}
              </label>
              <input
                id={`fud-${i}`}
                className="field"
                type="number"
                min={0}
                max={365}
                value={r.days}
                disabled={r.created}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, days: Math.max(0, Math.min(365, Number(e.target.value) || 0)) } : x)))}
              />
            </div>
            <button type="button" className={`btn ${r.created ? "btn-ghost" : "btn-primary"}`} disabled={r.created} onClick={() => void create(i)}>
              {r.created ? `✓ ${t.notes.taskCreated}` : t.notes.createTask}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
