import { describe, expect, it } from "vitest";
import { nextStepsToFollowUps, reviseNote } from "@/lib/notes";
import { FieldNoteSchema } from "@/types/models";

const base = FieldNoteSchema.parse({
  id: "n1",
  date: "2026-10-30",
  text: "Visited fake family. Roof leaking.",
  createdAt: "2026-10-30T10:00:00Z",
  updatedAt: "2026-10-30T10:00:00Z",
});

describe("field note versioning", () => {
  it("keeps the previous version when content changes", () => {
    const v2 = reviseNote(base, { text: "Visited fake family. Roof leaking badly.", template: base.template, organised: null }, "2026-10-30T11:00:00Z");
    expect(v2.text).toContain("badly");
    expect(v2.history).toHaveLength(1);
    expect(v2.history[0]!.text).toBe(base.text);
    expect(v2.history[0]!.savedAt).toBe(base.updatedAt);
    const v3 = reviseNote(v2, { text: "Third", template: v2.template, organised: null }, "2026-10-30T12:00:00Z");
    expect(v3.history.map((h) => h.text)).toEqual([base.text, v2.text]);
  });

  it("does not add history when nothing changed", () => {
    const same = reviseNote(base, { text: base.text, template: base.template, organised: null, place: "Fakepuram" }, "2026-10-30T11:00:00Z");
    expect(same.history).toHaveLength(0);
    expect(same.place).toBe("Fakepuram");
  });

  it("turns next-step lines into follow-up suggestions", () => {
    expect(nextStepsToFollowUps("- Call PHC\n2) Visit school\n\n• Check pension")).toEqual([
      { task: "Call PHC" },
      { task: "Visit school" },
      { task: "Check pension" },
    ]);
  });
});
