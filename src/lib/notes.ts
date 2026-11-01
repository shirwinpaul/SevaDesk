// Field-note versioning: edits are append-only. Saving changed content pushes the
// previous content into `history`; nothing is ever silently overwritten.

import type { FieldNote, NoteTemplate, OrganisedNote } from "@/types/models";

export interface NoteContent {
  text: string;
  template: NoteTemplate;
  organised: OrganisedNote | null;
}

const sameContent = (a: NoteContent, b: NoteContent) =>
  a.text === b.text && JSON.stringify(a.template) === JSON.stringify(b.template) && JSON.stringify(a.organised) === JSON.stringify(b.organised);

export function reviseNote(prev: FieldNote, next: NoteContent & Partial<Pick<FieldNote, "caseId" | "date" | "time" | "place">>, now: string): FieldNote {
  const changed = !sameContent(prev, next);
  return {
    ...prev,
    ...next,
    history: changed ? [...prev.history, { savedAt: prev.updatedAt, text: prev.text, template: prev.template, organised: prev.organised }] : prev.history,
    updatedAt: now,
  };
}

/** Turn template "next steps" lines into follow-up suggestions (user still confirms each). */
export function nextStepsToFollowUps(nextSteps: string): Array<{ task: string }> {
  return nextSteps
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map((task) => ({ task: task.slice(0, 200) }));
}

/** Plain-text rendering of a structured note (for copy / print). */
export function templateToText(t: NoteTemplate, labels: { saw: string; needs: string; actions: string; nextSteps: string }): string {
  return (["saw", "needs", "actions", "nextSteps"] as const)
    .filter((k) => t[k].trim())
    .map((k) => `${labels[k]}:\n${t[k].trim()}`)
    .join("\n\n");
}
